'use strict';

var usernamePage = document.querySelector('#username-page');
var chatPage = document.querySelector('#chat-page');
var usernameForm = document.querySelector('#usernameForm');
var messageForm = document.querySelector('#messageForm');
var messageInput = document.querySelector('#message');
var messageArea = document.querySelector('#messageArea');
var connectingElement = document.querySelector('.connecting');

var stompClient = null;
var username = null;

var colors = [
    '#2196F3', '#32c787', '#00BCD4', '#ff5652',
    '#ffc107', '#ff85af', '#FF9800', '#39bbb0'
];

function connect(event) {
    username = document.querySelector('#name').value.trim();

    if (username) {
        usernamePage.classList.add('hidden');
        chatPage.classList.remove('hidden');

        var socket = new SockJS('/ws');
        stompClient = Stomp.over(socket);

        stompClient.connect({}, onConnected, onError);
    }
    event.preventDefault();
}


function onConnected() {
    // Subscribe to the Public Topic
    stompClient.subscribe('/topic/public', onMessageReceived);

    // Fetch existing public messages (null chatRoomId for now)
    fetch('/api/messages')
        .then(response => response.json())
        .then(messages => {
            messages.forEach(message => {
                if (message.type === 'CHAT') {
                    onMessageReceived({ body: JSON.stringify(message) });
                }
            });
        })
        .catch(error => console.error("Could not fetch old messages:", error));

    // Tell your username to the server
    stompClient.send("/app/chat.addUser",
        {},
        JSON.stringify({ senderUsername: username, type: 'JOIN' })
    )
}


function onError(error) {
    console.error('Could not connect to WebSocket server. Please refresh this page to try again!');
}


function sendMessage(event) {
    var messageContent = messageInput.value.trim();
    // Assuming you have a chatRoomId input if you want groups, but empty means public room.
    var roomIdInput = document.querySelector('#recipient').value.trim();

    if (messageContent && stompClient) {
        var chatMessage = {
            senderUsername: username,
            content: messageInput.value,
            chatRoomId: roomIdInput === '' ? null : parseInt(roomIdInput),
            type: 'CHAT'
        };

        stompClient.send("/app/chat.sendMessage", {}, JSON.stringify(chatMessage));
        messageInput.value = '';
    }
    event.preventDefault();
}


function onMessageReceived(payload) {
    var message = JSON.parse(payload.body);

    var messageElement = document.createElement('li');

    var senderName = message.sender.username;

    if (message.type === 'JOIN') {
        messageElement.classList.add('event-message');
        message.content = senderName + ' joined!';
    } else if (message.type === 'LEAVE') {
        messageElement.classList.add('event-message');
        message.content = senderName + ' left!';
    } else {
        messageElement.classList.add('chat-message');

        var avatarElement = document.createElement('i');
        var avatarText = document.createTextNode(senderName[0].toUpperCase());
        avatarElement.appendChild(avatarText);
        avatarElement.style['background-color'] = getAvatarColor(senderName);

        messageElement.appendChild(avatarElement);

        var usernameElement = document.createElement('span');
        var usernameText = document.createTextNode(senderName);
        usernameElement.appendChild(usernameText);

        if (message.status) {
            var statusMark = document.createElement('span');
            statusMark.className = 'status-mark';
            statusMark.innerText = ' ✓ ' + message.status;
            statusMark.style.fontSize = '12px';
            statusMark.style.color = message.status === 'READ' ? '#34B7F1' : '#888';
            usernameElement.appendChild(statusMark);
        }

        messageElement.appendChild(usernameElement);
    }

    var textElement = document.createElement('p');
    var messageText = document.createTextNode(message.content);
    textElement.appendChild(messageText);

    messageElement.appendChild(textElement);

    messageArea.appendChild(messageElement);
    messageArea.scrollTop = messageArea.scrollHeight;
}


function getAvatarColor(messageSender) {
    var hash = 0;
    for (var i = 0; i < messageSender.length; i++) {
        hash = 31 * hash + messageSender.charCodeAt(i);
    }
    var index = Math.abs(hash % colors.length);
    return colors[index];
}

usernameForm.addEventListener('submit', connect, true)
messageForm.addEventListener('submit', sendMessage, true)
