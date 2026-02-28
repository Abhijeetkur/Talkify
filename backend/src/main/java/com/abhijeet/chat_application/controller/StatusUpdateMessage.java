package com.abhijeet.chat_application.controller;

import com.abhijeet.chat_application.entity.ChatMessage;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class StatusUpdateMessage {
    private ChatMessage.MessageType type;
    private Long chatRoomId;
    private List<Long> messageIds;
    private ChatMessage.MessageStatus newStatus;
}
