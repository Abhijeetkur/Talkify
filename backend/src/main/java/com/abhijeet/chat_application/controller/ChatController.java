package com.abhijeet.chat_application.controller;

import com.abhijeet.chat_application.entity.ChatMessage;
import com.abhijeet.chat_application.service.ChatMessageService;
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

    @MessageMapping("/chat.sendMessage")
    public void sendMessage(@Payload ChatMessage chatMessage) {
        if (chatMessage.getTimestamp() == null) {
            chatMessage.setTimestamp(LocalDateTime.now());
        }
        // Save the chat message in the DB
        chatMessageService.save(chatMessage);

        if (chatMessage.getRecipient() != null && !chatMessage.getRecipient().trim().isEmpty()) {
            // Send to recipient
            messagingTemplate.convertAndSend("/topic/" + chatMessage.getRecipient() + ".private", chatMessage);
            // Send back to sender so they see their own message
            messagingTemplate.convertAndSend("/topic/" + chatMessage.getSender() + ".private", chatMessage);
        } else {
            messagingTemplate.convertAndSend("/topic/public", chatMessage);
        }
    }

    @MessageMapping("/chat.addUser")
    @SendTo("/topic/public")
    public ChatMessage addUser(@Payload ChatMessage chatMessage, SimpMessageHeaderAccessor headerAccessor) {
        // Add username in web socket session
        headerAccessor.getSessionAttributes().put("username", chatMessage.getSender());

        if (chatMessage.getTimestamp() == null) {
            chatMessage.setTimestamp(LocalDateTime.now());
        }
        // Save the JOIN message in the DB
        chatMessageService.save(chatMessage);

        return chatMessage;
    }
}
