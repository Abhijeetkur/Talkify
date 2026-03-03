package com.abhijeet.chat_application.repository;

import com.abhijeet.chat_application.entity.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;

import java.util.List;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

        List<ChatMessage> findTop50ByChatRoomIdOrderByTimestampDesc(Long chatRoomId);

        List<ChatMessage> findTop50ByChatRoomIsNullOrderByTimestampDesc();

        @Query("SELECT m.id FROM ChatMessage m WHERE m.chatRoom.id = :chatRoomId AND m.sender.username != :senderUsername AND m.status IN :statuses")
        List<Long> findMessageIdsByChatRoomIdAndSenderUsernameNotAndStatusIn(
                        @Param("chatRoomId") Long chatRoomId,
                        @Param("senderUsername") String senderUsername,
                        @Param("statuses") List<ChatMessage.MessageStatus> statuses);

        @Query("SELECT m.id, m.chatRoom.id FROM ChatMessage m JOIN m.chatRoom.participants p WHERE p.username = :username AND m.sender.username != :username AND m.status = :status")
        List<Object[]> findMessageInfoByParticipantAndSenderNotAndStatus(
                        @Param("username") String username,
                        @Param("status") ChatMessage.MessageStatus status);

        @Modifying(clearAutomatically = true)
        @Query("UPDATE ChatMessage m SET m.status = :newStatus WHERE m.id IN :messageIds")
        int updateMessageStatusBulk(@Param("messageIds") List<Long> messageIds,
                        @Param("newStatus") ChatMessage.MessageStatus newStatus);

        @Query("SELECT m.sender.username, COUNT(m) FROM ChatMessage m JOIN m.chatRoom.participants p WHERE p.username = :username AND m.sender.username != :username AND m.status IN ('SENT', 'DELIVERED') GROUP BY m.sender.username")
        List<Object[]> countUnreadMessagesBySender(
                        @Param("username") String username);
}
