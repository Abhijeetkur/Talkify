package com.abhijeet.chat_application.repository;

import com.abhijeet.chat_application.entity.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    List<ChatMessage> findByChatRoomIdOrderByTimestampAsc(Long chatRoomId);

    List<ChatMessage> findByChatRoomIsNullOrderByTimestampAsc();
}
