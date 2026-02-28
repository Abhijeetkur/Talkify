package com.abhijeet.chat_application.controller;

import com.abhijeet.chat_application.dto.AuthRequest;
import com.abhijeet.chat_application.dto.AuthResponse;
import com.abhijeet.chat_application.entity.User;
import com.abhijeet.chat_application.repository.UserRepository;
import com.abhijeet.chat_application.security.JwtUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

        private final UserRepository userRepository;
        private final PasswordEncoder passwordEncoder;
        private final JwtUtils jwtUtils;
        private final AuthenticationManager authenticationManager;

        @PostMapping("/register")
        public ResponseEntity<?> register(@RequestBody AuthRequest request) {
                if (userRepository.findByUsername(request.getUsername()).isPresent()) {
                        return ResponseEntity.badRequest().body("Username is already taken");
                }

                User user = User.builder()
                                .username(request.getUsername())
                                .password(passwordEncoder.encode(request.getPassword()))
                                .fullName(request.getUsername())
                                .isOnline(true)
                                .build();

                userRepository.save(user);

                String jwt = jwtUtils.generateToken(user);
                return ResponseEntity.ok(AuthResponse.builder()
                                .token(jwt)
                                .username(user.getUsername())
                                .build());
        }

        @PostMapping("/login")
        public ResponseEntity<?> login(@RequestBody AuthRequest request) {
                try {
                        authenticationManager.authenticate(
                                        new UsernamePasswordAuthenticationToken(
                                                        request.getUsername(),
                                                        request.getPassword()));
                } catch (org.springframework.security.core.AuthenticationException e) {
                        return org.springframework.http.ResponseEntity
                                        .status(org.springframework.http.HttpStatus.UNAUTHORIZED)
                                        .body("Invalid username or password");
                }

                User user = userRepository.findByUsername(request.getUsername())
                                .orElseThrow();

                user.setOnline(true);
                userRepository.save(user);

                String jwt = jwtUtils.generateToken(user);

                return ResponseEntity.ok(AuthResponse.builder()
                                .token(jwt)
                                .username(user.getUsername())
                                .build());
        }
}
