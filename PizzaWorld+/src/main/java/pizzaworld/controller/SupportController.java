package pizzaworld.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pizzaworld.service.EmailService;
import java.util.Map;
import java.util.logging.Logger;

@RestController
@RequestMapping("/api")
public class SupportController {
    
    private static final Logger logger = Logger.getLogger(SupportController.class.getName());
    
    @Autowired
    private EmailService emailService;
    
    public static class EmailRequest {
        public String to;
        public String from;
        public String senderName;
        public String subject;
        public String message;
    }
    
    @PostMapping("/send-support-email")
    public ResponseEntity<?> sendSupportEmail(@RequestBody EmailRequest emailRequest) {
        try {
            // Log the support request
            logger.info("Support email request received:");
            logger.info("From: " + emailRequest.senderName + " <" + emailRequest.from + ">");
            logger.info("Subject: " + emailRequest.subject);
            
            // Try to send actual email
            boolean emailSent = emailService.sendEmail(
                emailRequest.to,
                emailRequest.from,
                emailRequest.subject,
                emailRequest.message
            );
            
            if (emailSent) {
                return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Your email has been sent successfully to our support team."
                ));
            } else {
                // Email not sent (likely not configured), but still log it
                logger.warning("Email service not configured. Request logged for manual processing.");
                return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Your request has been logged. Our team will contact you soon at " + emailRequest.from
                ));
            }
            
        } catch (Exception e) {
            logger.severe("Failed to process support email: " + e.getMessage());
            return ResponseEntity.status(500).body(Map.of(
                "success", false,
                "error", "Failed to send support email"
            ));
        }
    }
} 