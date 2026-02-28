package com.abhijeet.chat_application.repository;

import com.abhijeet.chat_application.entity.ChatRoom;
import com.abhijeet.chat_application.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatRoomRepository extends JpaRepository<ChatRoom, Long> {
    List<ChatRoom> findByParticipantsContaining(User participant);
}
