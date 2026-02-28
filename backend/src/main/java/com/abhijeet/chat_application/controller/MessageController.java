package com.abhijeet.chat_application.controller;

import com.abhijeet.chat_application.entity.ChatMessage;
import com.abhijeet.chat_application.service.ChatMessageService;
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

    private final ChatMessageService chatMessageService;

    @GetMapping
    public ResponseEntity<List<ChatMessage>> getMessages(@RequestParam(required = false) Long chatRoomId) {
        return ResponseEntity.ok(chatMessageService.getMessages(chatRoomId));
    }
}
