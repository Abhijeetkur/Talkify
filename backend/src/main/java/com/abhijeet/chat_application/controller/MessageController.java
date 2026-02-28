package com.abhijeet.chat_application.controller;

import com.abhijeet.chat_application.model.ChatMessage;
import com.abhijeet.chat_application.repository.ChatMessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
public class MessageController {

    private final ChatMessageRepository chatMessageRepository;

    @GetMapping
    public ResponseEntity<List<ChatMessage>> getMessages(@RequestParam(required = false) String username) {
        if (username != null && !username.trim().isEmpty()) {
            return ResponseEntity.ok(chatMessageRepository.findMessagesForUser(username));
        }
        return ResponseEntity.ok(chatMessageRepository.findAll());
    }
}
