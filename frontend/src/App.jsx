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

  const loadUsers = () => {
    fetch('/api/users')
      .then(res => res.json())
      .then(data => setUsers(data.filter(u => u.username !== username))) // Don't show self
      .catch(err => console.error(err));
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

  const handleConnect = (e) => {
    e.preventDefault();
    if (!username.trim()) return;

    const socket = new SockJS('/ws');
    const client = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      onConnect: () => {
        setIsConnected(true);
        stompClientRef.current = client;

        // Tell the server user joined (which creates the user in DB)
        client.publish({
          destination: '/app/chat.addUser',
          body: JSON.stringify({ senderUsername: username, type: 'JOIN' }),
        });

        // Initialize logic removed for public chat. You must now select a user.
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

    let topic = '';
    let fetchUrl = '';

    if (chat.type === 'private') {
      // Get or create 1-on-1 room from backend
      try {
        const res = await fetch(`/api/chatrooms/1on1?user1=${encodeURIComponent(username)}&user2=${encodeURIComponent(chat.name)}`);
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
    fetch(fetchUrl)
      .then((res) => res.json())
      .then((data) => setMessages(data))
      .catch(err => console.error("Error fetching messages:", err));

    // Subscribe to the active room
    if (stompClientRef.current && stompClientRef.current.connected) {
      currentSubscriptionRef.current = stompClientRef.current.subscribe(topic, (message) => {
        const parsedMessage = JSON.parse(message.body);
        setMessages((prev) => [...prev, parsedMessage]);
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
            <h1 className="text-3xl font-bold text-green-500 mb-2 font-sans tracking-tight">WhatsApp Web</h1>
            <p className="text-gray-500">Enter your name to join the chat</p>
          </div>

          <form onSubmit={handleConnect} className="space-y-6">
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
            <button
              type="submit"
              className="w-full bg-green-500 text-white font-semibold py-3 px-4 rounded-lg hover:bg-green-600 transition duration-200 ease-in-out transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
            >
              Start Chatting
            </button>
          </form>
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
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <h3 className="text-[17px] font-normal text-gray-900">{u.username}</h3>
                  {u.online && <div className="w-2.5 h-2.5 bg-green-500 rounded-full"></div>}
                </div>
                <p className="text-sm text-gray-500 whitespace-nowrap overflow-hidden text-ellipsis">
                  {u.online ? 'Online' : formatLastSeen(u.lastSeen)}
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
            <h1 className="text-3xl font-light text-gray-700 mb-4 mt-8">WhatsApp Web</h1>
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