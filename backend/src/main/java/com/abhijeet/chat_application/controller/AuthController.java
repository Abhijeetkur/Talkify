package com.abhijeet.chat_application.controller;

import com.abhijeet.chat_application.dto.AuthRequest;
import com.abhijeet.chat_application.dto.AuthResponse;
import com.abhijeet.chat_application.entity.User;
import com.abhijeet.chat_application.exception.DuplicateResourceException;
import com.abhijeet.chat_application.exception.ResourceNotFoundException;
import com.abhijeet.chat_application.exception.UnauthorizedException;
import com.abhijeet.chat_application.repository.UserRepository;
import com.abhijeet.chat_application.security.JwtUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
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
        public ResponseEntity<AuthResponse> register(@RequestBody AuthRequest request) {
                if (userRepository.findByUsername(request.getUsername()).isPresent()) {
                        throw new DuplicateResourceException("User", "username", request.getUsername());
                }

                User user = User.builder()
                                .username(request.getUsername())
                                .password(passwordEncoder.encode(request.getPassword()))
                                .fullName(request.getUsername())
                                .publicKey(request.getPublicKey())
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
        public ResponseEntity<AuthResponse> login(@RequestBody AuthRequest request) {
                try {
                        authenticationManager.authenticate(
                                        new UsernamePasswordAuthenticationToken(
                                                        request.getUsername(),
                                                        request.getPassword()));
                } catch (BadCredentialsException e) {
                        throw new UnauthorizedException("Invalid username or password");
                }

                User user = userRepository.findByUsername(request.getUsername())
                                .orElseThrow(() -> new ResourceNotFoundException("User", "username",
                                                request.getUsername()));

                user.setOnline(true);
                if (request.getPublicKey() != null && !request.getPublicKey().isEmpty()) {
                        user.setPublicKey(request.getPublicKey());
                }
                userRepository.save(user);

                String jwt = jwtUtils.generateToken(user);

                return ResponseEntity.ok(AuthResponse.builder()
                                .token(jwt)
                                .username(user.getUsername())
                                .build());
        }
}
