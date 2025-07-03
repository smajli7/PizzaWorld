package pizzaworld.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import java.util.logging.Logger;

@Service
public class EmailService {
    
    private static final Logger logger = Logger.getLogger(EmailService.class.getName());
    
    @Autowired(required = false)
    private JavaMailSender mailSender;
    
    public boolean sendEmail(String to, String from, String subject, String text) {
        try {
            if (mailSender == null) {
                logger.warning("JavaMailSender not configured. Email will not be sent.");
                logger.info("Email that would have been sent:");
                logger.info("To: " + to);
                logger.info("From: " + from);
                logger.info("Subject: " + subject);
                logger.info("Body: " + text);
                return false;
            }
            
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(to);
            message.setFrom(from);
            message.setSubject(subject);
            message.setText(text);
            
            mailSender.send(message);
            logger.info("Email sent successfully to: " + to);
            return true;
            
        } catch (Exception e) {
            logger.severe("Failed to send email: " + e.getMessage());
            return false;
        }
    }
} 