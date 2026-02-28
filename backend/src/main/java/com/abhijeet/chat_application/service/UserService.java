package com.abhijeet.chat_application.service;

import com.abhijeet.chat_application.entity.User;
import com.abhijeet.chat_application.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    public User getOrCreateUser(String username) {
        return userRepository.findByUsername(username).orElseGet(() -> {
            User newUser = User.builder()
                    .username(username)
                    .fullName(username)
                    .isOnline(true)
                    .build();
            return userRepository.save(newUser);
        });
    }

    public void disconnect(User user) {
        user.setOnline(false);
        user.setLastSeen(LocalDateTime.now());
        userRepository.save(user);
    }

    public void connect(User user) {
        user.setOnline(true);
        userRepository.save(user);
    }
}
