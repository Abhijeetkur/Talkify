package com.abhijeet.chat_application.controller;

import com.abhijeet.chat_application.entity.ChatMessage;
import com.abhijeet.chat_application.entity.ChatRoom;
import com.abhijeet.chat_application.entity.User;
import com.abhijeet.chat_application.repository.ChatRoomRepository;
import com.abhijeet.chat_application.service.ChatMessageService;
import com.abhijeet.chat_application.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.stereotype.Controller;

import java.time.LocalDateTime;

@Controller
@RequiredArgsConstructor
@Slf4j
public class ChatController {

    private final ChatMessageService chatMessageService;
    private final SimpMessageSendingOperations messagingTemplate;
    private final UserService userService;
    private final ChatRoomRepository chatRoomRepository;

    @MessageMapping("/chat.sendMessage")
    public void sendMessage(@Payload ChatMessageRequest request) {
        User sender = userService.getOrCreateUser(request.getSenderUsername());
        ChatRoom chatRoom = null;
        if (request.getChatRoomId() != null) {
            chatRoom = chatRoomRepository.findById(request.getChatRoomId()).orElse(null);
        }

        ChatMessage chatMessage = ChatMessage.builder()
                .sender(sender)
                .chatRoom(chatRoom)
                .content(request.getContent())
                .type(request.getType())
                .timestamp(LocalDateTime.now())
                .status(ChatMessage.MessageStatus.SENT)
                .build();

        // Save the chat message in the DB
        chatMessageService.save(chatMessage);

        if (chatRoom != null) {
            // Provide to a specific chat room topic
            messagingTemplate.convertAndSend("/topic/chatrooms/" + chatRoom.getId(), chatMessage);
        } else {
            // General public topic
            messagingTemplate.convertAndSend("/topic/public", chatMessage);
        }
    }

    @MessageMapping("/chat.addUser")
    @SendTo("/topic/public")
    public ChatMessage addUser(@Payload ChatMessageRequest request, SimpMessageHeaderAccessor headerAccessor) {
        User user = userService.getOrCreateUser(request.getSenderUsername());
        userService.connect(user);

        // Add username in web socket session
        headerAccessor.getSessionAttributes().put("username", user.getUsername());

        ChatMessage chatMessage = ChatMessage.builder()
                .sender(user)
                .type(ChatMessage.MessageType.JOIN)
                .timestamp(LocalDateTime.now())
                .build();

        // Save the JOIN message in the DB
        chatMessageService.save(chatMessage);

        return chatMessage;
    }
}
