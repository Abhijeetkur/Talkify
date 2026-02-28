import React, { useState, useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Send, User as UserIcon, LogOut, Check, CheckCheck, Users } from 'lucide-react';
import './index.css';

const ChatApp = () => {
  const [username, setUsername] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [users, setUsers] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [lastMessages, setLastMessages] = useState({});
  const [password, setPassword] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('chatToken') || '');
  const [error, setError] = useState('');

  const [activeChat, setActiveChat] = useState(null); // No default public room

  const stompClientRef = useRef(null);
  const messagesEndRef = useRef(null);
  const currentSubscriptionRef = useRef(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const authHeaders = {
    'Authorization': `Bearer ${token}`
  };

  const loadUsers = () => {
    fetch('/api/users', { headers: authHeaders })
      .then(res => res.json())
      .then(data => setUsers(data.filter(u => u.username !== username))) // Don't show self
      .catch(err => console.error(err));

    fetch(`/api/messages/unread-counts?username=${encodeURIComponent(username)}`, { headers: authHeaders })
      .then(res => res.json())
      .then(data => setUnreadCounts(data))
      .catch(err => console.error("Error fetching unread counts:", err));

    fetch(`/api/messages/last-messages?username=${encodeURIComponent(username)}`, { headers: authHeaders })
      .then(res => res.json())
      .then(data => setLastMessages(data))
      .catch(err => console.error("Error fetching last messages:", err));
  };

  // Polling for users every 5 seconds (temporary solution to keep online status fresh)
  useEffect(() => {
    let interval;
    if (isConnected) {
      loadUsers();
      interval = setInterval(loadUsers, 5000);
    }
    return () => clearInterval(interval);
  }, [isConnected, username]);

  const handleAuth = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setError('');

    const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Authentication failed');
      }

      const data = await response.json();
      setToken(data.token);
      localStorage.setItem('chatToken', data.token);
      localStorage.setItem('chatUsername', data.username);
      connectWebSocket(data.token, data.username);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    const storedToken = localStorage.getItem('chatToken');
    const storedUsername = localStorage.getItem('chatUsername');
    if (storedToken && storedUsername && !isConnected) {
      setUsername(storedUsername);
      setToken(storedToken);
      connectWebSocket(storedToken, storedUsername);
    }
  }, []);

  const connectWebSocket = (jwtToken, currentUsername) => {
    const socket = new SockJS('/ws');
    const client = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      connectHeaders: {
        Authorization: `Bearer ${jwtToken}`
      },
      onConnect: () => {
        setIsConnected(true);
        stompClientRef.current = client;

        client.publish({
          destination: '/app/chat.addUser',
          body: JSON.stringify({ senderUsername: currentUsername, type: 'JOIN' }),
        });
      },
      onStompError: (frame) => {
        console.error('Broker reported error: ' + frame.headers['message']);
        console.error('Additional details: ' + frame.body);
      },
    });

    client.activate();
  };

  const openChat = async (chat) => {
    // Unsubscribe from previous if exists
    if (currentSubscriptionRef.current) {
      currentSubscriptionRef.current.unsubscribe();
    }

    setActiveChat(chat);
    setMessages([]); // clear current view
    setUnreadCounts(prev => ({ ...prev, [chat.name]: 0 })); // reset unread count when opening chat

    let topic = '';
    let fetchUrl = '';

    if (chat.type === 'private') {
      try {
        const res = await fetch(`/api/chatrooms/1on1?user1=${encodeURIComponent(username)}&user2=${encodeURIComponent(chat.name)}`, { headers: authHeaders });
        const room = await res.json();
        chat.id = room.id; // set the true DB chatRoomId
        setActiveChat({ ...chat, id: room.id });

        topic = `/topic/chatrooms/${room.id}`;
        fetchUrl = `/api/messages?chatRoomId=${room.id}`;
      } catch (err) {
        console.error("Failed to establish 1 on 1 room", err);
        return;
      }
    }

    // Fetch message history for this room
    fetch(fetchUrl, { headers: authHeaders })
      .then((res) => res.json())
      .then((data) => {
        setMessages(data);
        // Mark existing messages as read when we open the chat
        if (chat.id && stompClientRef.current?.connected) {
          stompClientRef.current.publish({
            destination: '/app/chat.readMessages',
            body: JSON.stringify({ chatRoomId: chat.id, senderUsername: username })
          });
        }
      })
      .catch(err => console.error("Error fetching messages:", err));

    // Subscribe to the active room
    if (stompClientRef.current && stompClientRef.current.connected) {
      currentSubscriptionRef.current = stompClientRef.current.subscribe(topic, (message) => {
        const parsedMessage = JSON.parse(message.body);

        if (parsedMessage.type === 'STATUS_UPDATE') {
          setMessages((prev) => prev.map(m =>
            (parsedMessage.messageIds || []).includes(m.id) ? { ...m, status: parsedMessage.newStatus } : m
          ));
        } else {
          setMessages((prev) => [...prev, parsedMessage]);

          // Send read receipt if we receive a message that isn't ours while actively in this chat
          const senderName = parsedMessage.senderUsername || parsedMessage.sender?.username;
          if (parsedMessage.type === 'CHAT' && senderName !== username) {
            stompClientRef.current.publish({
              destination: '/app/chat.readMessages',
              body: JSON.stringify({ chatRoomId: parsedMessage.chatRoomId || chat.id, senderUsername: username })
            });
          }
        }
      });
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (messageInput.trim() && stompClientRef.current?.connected) {
      const chatMessage = {
        senderUsername: username,
        content: messageInput,
        chatRoomId: activeChat.id, // null for public, number for private
        type: 'CHAT'
      };

      stompClientRef.current.publish({
        destination: '/app/chat.sendMessage',
        body: JSON.stringify(chatMessage)
      });
      setMessageInput('');
    }
  };

  const handleDisconnect = () => {
    if (stompClientRef.current) {
      stompClientRef.current.deactivate();
    }
    setIsConnected(false);
    setMessages([]);
    setUsername('');
    setPassword('');
    setToken('');
    localStorage.removeItem('chatToken');
    localStorage.removeItem('chatUsername');
    currentSubscriptionRef.current = null;
  };

  const getInitials = (name) => {
    return name ? name.charAt(0).toUpperCase() : '?';
  };

  const getAvatarColor = (name) => {
    const colors = ['bg-blue-500', 'bg-green-500', 'bg-red-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'];
    let hash = 0;
    if (name) {
      for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
      }
    }
    const index = Math.abs(hash % colors.length);
    return colors[index];
  };

  const formatLastSeen = (dateString) => {
    if (!dateString) return 'Offline';
    const date = new Date(dateString);
    const today = new Date();

    // Check if valid date
    if (isNaN(date.getTime())) return 'Offline';

    const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear();

    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `last seen today at ${time}`;
    if (isYesterday) return `last seen yesterday at ${time}`;
    return `last seen ${date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at ${time}`;
  };

  const renderMessageStatus = (status, isMine) => {
    if (!isMine || !status) return null;

    switch (status) {
      case 'SENT':
        return <Check size={14} className="text-gray-400 ml-1 inline" />;
      case 'DELIVERED':
        return <CheckCheck size={14} className="text-gray-400 ml-1 inline" />;
      case 'READ':
        return <CheckCheck size={14} className="text-blue-500 ml-1 inline" />;
      default:
        return null;
    }
  };

  if (!isConnected) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-100">
        <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg border border-gray-200">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-green-500 mb-2 font-sans tracking-tight">Talkify</h1>
            <p className="text-gray-500">{isLoginMode ? 'Login to your account' : 'Create an account'} to join the chat</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-500 p-3 rounded-lg text-sm text-center border border-red-200">
                {error}
              </div>
            )}
            <div>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                required
              />
            </div>
            <div>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-green-500 text-white font-semibold py-3 px-4 rounded-lg mt-2 hover:bg-green-600 transition duration-200 ease-in-out transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
            >
              {isLoginMode ? 'Login' : 'Sign Up'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            {isLoginMode ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => { setIsLoginMode(!isLoginMode); setError(''); }}
              className="text-green-500 hover:text-green-600 font-semibold underline-offset-2 hover:underline focus:outline-none"
            >
              {isLoginMode ? 'Sign up' : 'Login'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#efeae2] font-sans">
      {/* Sidebar */}
      <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col hidden md:flex">
        {/* Header */}
        <div className="bg-[#f0f2f5] p-3 flex justify-between items-center border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg ${getAvatarColor(username)}`}>
              {getInitials(username)}
            </div>
            <span className="font-semibold text-gray-800">{username}</span>
          </div>
          <button onClick={handleDisconnect} className="text-gray-600 hover:text-red-500 transition-colors">
            <LogOut size={20} />
          </button>
        </div>

        {/* Contacts/Chats List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-3 bg-white text-sm font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
            Select a User to Chat
          </div>

          {users.map(u => (
            <div
              key={u.id}
              onClick={() => openChat({ type: 'private', id: null, name: u.username })}
              className={`p-3 border-b border-gray-100 flex items-center space-x-4 cursor-pointer hover:bg-[#f5f6f6] ${activeChat?.name === u.username ? 'bg-[#ebebeb]' : ''}`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${getAvatarColor(u.username)}`}>
                {getInitials(u.username)}
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="flex justify-between items-center mb-0.5">
                  <h3 className="text-[17px] font-normal text-gray-900 truncate pr-2">{u.username}</h3>
                  {unreadCounts[u.username] > 0 && (
                    <div className="w-[22px] h-[22px] bg-green-500 rounded-full flex justify-center items-center text-white text-[11.5px] font-bold flex-shrink-0">
                      {unreadCounts[u.username]}
                    </div>
                  )}
                </div>
                <p className={`text-sm whitespace-nowrap overflow-hidden text-ellipsis ${unreadCounts[u.username] > 0 ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                  {lastMessages[u.username] || 'Say hi...'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col w-full md:w-2/3 bg-[url('https://whatsapp-clone-web.netlify.app/bg-chat-tile-dark_a4be512e7195b6b733d9110b408f075d.png')] bg-repeat">
        {!activeChat ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-[#f0f2f5] border-b-[6px] border-green-500">
            <h1 className="text-3xl font-light text-gray-700 mb-4 mt-8">Talkify</h1>
            <p className="text-sm text-gray-500 text-center max-w-md leading-relaxed">
              Select a user from the contact list to start a 1-on-1 private chat.<br />
              Messages are securely segregated between users.
            </p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="bg-[#f0f2f5] p-3 flex items-center space-x-4 border-b border-gray-200 sticky top-0 z-10">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg ${getAvatarColor(activeChat.name)}`}>
                {getInitials(activeChat.name)}
              </div>
              <div>
                <h2 className="font-normal text-[16px] text-gray-900">{activeChat.name}</h2>
                <p className="text-[13px] text-gray-500">
                  {users.find(u => u.username === activeChat.name)?.online ? 'Online' : formatLastSeen(users.find(u => u.username === activeChat.name)?.lastSeen)}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 relative scroll-smooth">
              {messages.map((message, index) => {
                const isEvent = message.type === 'JOIN' || message.type === 'LEAVE';
                const senderName = message.sender?.username || message.senderUsername;
                const isMine = senderName === username;

                if (isEvent) {
                  return (
                    <div key={index} className="flex justify-center my-2">
                      <div className="bg-white/90 shadow-sm text-gray-500 rounded-lg px-3 py-1 text-xs">
                        {senderName} {message.type === 'JOIN' ? 'joined' : 'left'}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={index} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`relative max-w-[75%] rounded-lg px-3 pt-2 pb-1 text-[14.2px] shadow-sm flex flex-col ${isMine ? 'bg-[#d9fdd3] rounded-tr-none' : 'bg-white rounded-tl-none'
                        }`}
                    >
                      <div className="flex flex-wrap items-end gap-2">
                        <span className="text-gray-900 leading-[19px] whitespace-pre-wrap word-break">{message.content}</span>

                        <div className="flex items-center space-x-1 float-right mt-1 ml-auto text-[11px] text-gray-500">
                          <span>
                            {message.timestamp
                              ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {renderMessageStatus(message.status, isMine)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="bg-[#f0f2f5] p-3 flex items-center space-x-2">
              <form onSubmit={handleSendMessage} className="flex-1 flex max-w-full items-center bg-white rounded-lg border border-gray-300 overflow-hidden">
                <input
                  type="text"
                  placeholder="Type a message"
                  className="flex-1 py-3 px-4 text-[15px] outline-none border-none bg-transparent"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                />
                <button
                  type="submit"
                  className="p-3 text-gray-500 hover:text-green-500 transition-colors"
                  disabled={!messageInput.trim()}
                >
                  <Send size={24} />
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ChatApp;