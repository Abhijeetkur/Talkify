package com.abhijeet.chat_application.service;

import com.abhijeet.chat_application.entity.ChatMessage;
import com.abhijeet.chat_application.repository.ChatMessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

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
}
