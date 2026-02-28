package com.abhijeet.chat_application.controller;

import com.abhijeet.chat_application.entity.ChatMessage;
import lombok.Data;

@Data
public class ChatMessageRequest {
    private String content;
    private String senderUsername;
    private Long chatRoomId;
    private ChatMessage.MessageType type;
}
