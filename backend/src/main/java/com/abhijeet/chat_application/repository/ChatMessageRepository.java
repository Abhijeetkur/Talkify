package com.abhijeet.chat_application.repository;

import com.abhijeet.chat_application.entity.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    @Query("SELECT c FROM ChatMessage c WHERE c.recipient IS NULL OR c.recipient = :username OR c.sender = :username ORDER BY c.timestamp ASC")
    List<ChatMessage> findMessagesForUser(@Param("username") String username);
}
