package com.abhijeet.chat_application.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String username;

    private String fullName;
    private String profilePictureUrl;
    private String aboutStatus;

    @Builder.Default
    private boolean isOnline = false;

    private LocalDateTime lastSeen;
}
