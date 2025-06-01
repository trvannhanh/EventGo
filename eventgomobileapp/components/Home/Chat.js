import React, { useState, useEffect, useCallback, useContext } from 'react';
import { View, StyleSheet, FlatList, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { db } from '../../configs/firebase';
import { COLORS } from '../styles/MyStyles';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MyUserContext } from '../../configs/MyContexts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Apis, { authApis, endpoints } from '../../configs/Apis';
import { ref, onValue, push, set, off } from 'firebase/database';

const Chat = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { eventId } = route.params; // Removed orderId
  const user = useContext(MyUserContext);
  const [messages, setMessages] = useState([]);
  const [organizerId, setOrganizerId] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [localUser, setLocalUser] = useState(user);

  // Fetch user data if not available in context
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) {
          throw new Error('No token found in AsyncStorage');
        }
        const authApi = authApis(token);
        const response = await authApi.get(endpoints.currentUser);
        const userData = {
          id: response.data.id,
          firstName: response.data.first_name || response.data.username,
          username: response.data.username,
          email: response.data.email,
          phone: response.data.phone,
          avatar: response.data.avatar,
          role: response.data.role,
        };
        setLocalUser(userData);
      } catch (error) {
        console.error('Error fetching user data:', error);
        Alert.alert('Error', 'Could not load user information. Please log in again.');
      }
    };

    if (!user || !user.id) {
      fetchUserData();
    } else {
      setLocalUser(user);
    }
  }, [user]);

  // Fetch organizer information
  useEffect(() => {
    const fetchOrganizer = async () => {
      try {
        const response = await Apis.get(endpoints.eventDetail(eventId));
        const organizerId = response.data.organizer.id;
        if (organizerId) {
          setOrganizerId(organizerId);
        } else {
          console.warn('No organizerId found in event:', response.data);
        }
      } catch (error) {
        console.error('Error fetching organizer:', error);
      }
    };
    fetchOrganizer();
  }, [eventId]);

  // Listen for messages in the event's chat room
  useEffect(() => {
    const chatRef = ref(db, `chat_rooms/event_${eventId}/messages`);
    const unsubscribe = onValue(chatRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const messageList = Object.keys(data).map((key) => ({
          id: key,
          text: data[key].text,
          createdAt: new Date(data[key].timestamp),
          senderId: data[key].senderId,
          senderName: data[key].senderName,
          isOrganizer: data[key].senderId === organizerId?.toString(),
        }));
        setMessages(messageList.reverse());
      } else {
        setMessages([]);
      }
    });

    return () => off(chatRef); // Cleanup listener on unmount
  }, [eventId, organizerId]);

  // Send a message
  const onSend = useCallback(async () => {
    if (!newMessage.trim()) return;

    if (!localUser || !localUser.id) {
      console.error('Local user or user.id is missing');
      Alert.alert('Error', 'Invalid user information. Please log in again.');
      return;
    }

    try {
      const chatRef = ref(db, `chat_rooms/event_${eventId}/messages`);
      const newMessageRef = push(chatRef);
      await set(newMessageRef, {
        senderId: localUser.id.toString(),
        senderName: localUser.firstName || localUser.username || 'User',
        text: newMessage.trim(),
        timestamp: Date.now(),
      });

      setNewMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
      Alert.alert('Error', 'Could not send message. Please try again.');
    }
  }, [localUser, eventId, newMessage]);

  // Render a message
  const renderMessage = ({ item }) => {
    const isCurrentUser = item.senderId === (localUser?.id?.toString() || '');
    return (
      <View
        style={[
          styles.messageContainer,
          isCurrentUser ? styles.messageRight : styles.messageLeft,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isCurrentUser
              ? { backgroundColor: COLORS.primary }
              : item.isOrganizer
              ? { backgroundColor: COLORS.secondary } // Highlight organizer messages
              : { backgroundColor: COLORS.lightPrimary },
          ]}
        >
          <Text style={styles.senderName}>
            {item.senderName}
            {item.isOrganizer ? ' (Organizer)' : ''}
          </Text>
          <Text
            style={[
              styles.messageText,
              isCurrentUser ? { color: COLORS.onPrimary } : { color: COLORS.text },
            ]}
          >
            {item.text}
          </Text>
          <Text style={styles.messageTime}>
            {item.createdAt.toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        inverted
        contentContainerStyle={styles.messageList}
      />
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message..."
          placeholderTextColor={COLORS.textSecondary}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!localUser || !localUser.id || !newMessage.trim()) && { opacity: 0.5 },
          ]}
          onPress={() => {
            console.log('Send button pressed', {
              user: !!localUser,
              userId: localUser?.id,
              newMessage: newMessage.trim(),
            });
            onSend();
          }}
          disabled={!localUser || !localUser.id || !newMessage.trim()}
        >
          <MaterialCommunityIcons name="send" size={24} color={COLORS.onPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  messageList: {
    padding: 10,
  },
  messageContainer: {
    marginVertical: 5,
    maxWidth: '80%',
  },
  messageLeft: {
    alignSelf: 'flex-start',
  },
  messageRight: {
    alignSelf: 'flex-end',
  },
  messageBubble: {
    padding: 10,
    borderRadius: 15,
  },
  senderName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
    marginBottom: 5,
  },
  messageText: {
    fontSize: 16,
  },
  messageTime: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 5,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  textInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    color: COLORS.text,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default Chat;