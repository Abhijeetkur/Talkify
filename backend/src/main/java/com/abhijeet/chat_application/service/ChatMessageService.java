package com.abhijeet.chat_application.service;

import com.abhijeet.chat_application.entity.ChatMessage;
import com.abhijeet.chat_application.entity.User;
import com.abhijeet.chat_application.repository.ChatMessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ChatMessageService {

    private final ChatMessageRepository chatMessageRepository;

    public ChatMessage save(ChatMessage chatMessage) {
        return chatMessageRepository.save(chatMessage);
    }

    public List<ChatMessage> getMessages(Long chatRoomId) {
        if (chatRoomId != null) {
            return chatMessageRepository.findByChatRoomIdOrderByTimestampAsc(chatRoomId);
        }
        return chatMessageRepository.findByChatRoomIsNullOrderByTimestampAsc();
    }

    @Transactional
    public List<Long> markAsRead(Long chatRoomId, String readerUsername) {
        List<ChatMessage> unread = chatMessageRepository.findByChatRoomIdAndSenderUsernameNotAndStatusIn(
                chatRoomId, readerUsername,
                Arrays.asList(ChatMessage.MessageStatus.SENT, ChatMessage.MessageStatus.DELIVERED));
        if (unread.isEmpty())
            return Collections.emptyList();

        List<Long> messageIds = new ArrayList<>();
        for (ChatMessage message : unread) {
            message.setStatus(ChatMessage.MessageStatus.READ);
            messageIds.add(message.getId());
        }
        chatMessageRepository.saveAll(unread);
        return messageIds;
    }

    @Transactional
    public List<ChatMessage> markAsDeliveredForUser(String username) {
        List<ChatMessage> messages = chatMessageRepository.findMessagesByParticipantAndSenderNotAndStatus(
                username, ChatMessage.MessageStatus.SENT);
        if (messages.isEmpty())
            return Collections.emptyList();

        for (ChatMessage message : messages) {
            message.setStatus(ChatMessage.MessageStatus.DELIVERED);
        }
        chatMessageRepository.saveAll(messages);
        return messages;
    }

    public java.util.Map<String, Long> getUnreadCounts(String username) {
        List<Object[]> results = chatMessageRepository.countUnreadMessagesBySender(username);
        java.util.Map<String, Long> counts = new java.util.HashMap<>();
        for (Object[] result : results) {
            counts.put((String) result[0], ((Number) result[1]).longValue());
        }
        return counts;
    }

    public java.util.Map<String, String> getLastMessages(String username) {
        List<ChatMessage> latestMessages = chatMessageRepository.findLatestMessagesByParticipant(username);
        java.util.Map<String, String> lastMessages = new java.util.HashMap<>();

        for (ChatMessage message : latestMessages) {
            if (message.getChatRoom() != null && message.getContent() != null) {
                for (User participant : message.getChatRoom().getParticipants()) {
                    if (!participant.getUsername().equals(username)) {
                        lastMessages.put(participant.getUsername(), message.getContent());
                        break;
                    }
                }
            }
        }
        return lastMessages;
    }
}
