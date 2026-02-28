package com.abhijeet.chat_application.repository;

import com.abhijeet.chat_application.entity.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.data.repository.query.Param;

import java.util.List;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    List<ChatMessage> findByChatRoomIdOrderByTimestampAsc(Long chatRoomId);

    List<ChatMessage> findByChatRoomIsNullOrderByTimestampAsc();

    List<ChatMessage> findByChatRoomIdAndSenderUsernameNotAndStatusIn(Long chatRoomId, String senderUsername,
            List<ChatMessage.MessageStatus> statuses);

    @Query("SELECT m FROM ChatMessage m JOIN m.chatRoom.participants p WHERE p.username = :username AND m.sender.username != :username AND m.status = :status")
    List<ChatMessage> findMessagesByParticipantAndSenderNotAndStatus(
            @Param("username") String username,
            @Param("status") ChatMessage.MessageStatus status);

    @Query("SELECT m.sender.username, COUNT(m) FROM ChatMessage m JOIN m.chatRoom.participants p WHERE p.username = :username AND m.sender.username != :username AND m.status IN ('SENT', 'DELIVERED') GROUP BY m.sender.username")
    List<Object[]> countUnreadMessagesBySender(
            @Param("username") String username);

    @Query("SELECT m FROM ChatMessage m WHERE m.id IN (SELECT MAX(c.id) FROM ChatMessage c GROUP BY c.chatRoom.id) AND EXISTS (SELECT p FROM m.chatRoom.participants p WHERE p.username = :username)")
    List<ChatMessage> findLatestMessagesByParticipant(
            @Param("username") String username);
}
