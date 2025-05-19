import React, { useState, useEffect, useCallback, useContext } from 'react';
import { View, StyleSheet, FlatList, Text, TextInput, TouchableOpacity } from 'react-native';
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
  const { orderId } = route.params;
  const user = useContext(MyUserContext);
  const [messages, setMessages] = useState([]);
  const [organizerId, setOrganizerId] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [localUser, setLocalUser] = useState(user);

  // Lấy thông tin người dùng nếu user từ context không có
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) {
          throw new Error('Không tìm thấy token trong AsyncStorage');
        }
        const authApi = authApis(token);
        const response = await authApi.get(endpoints.currentUser);
        console.log('User data from API:', response.data);
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
        // Cập nhật MyUserContext
       
      } catch (error) {
        console.error('Lỗi khi lấy thông tin người dùng:', error);
        Alert.alert('Lỗi', 'Không thể tải thông tin người dùng. Vui lòng đăng nhập lại.');
      }
    };

    if (!user || !user.id) {
      fetchUserData();
    } else {
      setLocalUser(user);
    }
  }, [user]);


  // Lấy thông tin organizer từ API
  useEffect(() => {
    const fetchOrganizer = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        console.log('Token:', token);
        if (!token) {
          throw new Error('Không tìm thấy token trong AsyncStorage');
        }

        const url = `${endpoints['orders']}${orderId}/`;
        const response = await Apis.get(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const details = response.data.order?.details;
        if (Array.isArray(details) && details.length > 0) {
          const event = details[0]?.ticket?.event;
          const organizerId = event?.organizer?.id;

          if (organizerId) {
            setOrganizerId(organizerId);
          } else {
            console.warn('Không tìm thấy organizerId trong event:', event);
          }
        } else {
          console.warn('Không có details trong đơn hàng:', response.data.order);
        }
      } catch (error) {
        console.error('Lỗi khi lấy thông tin organizer:', error);
      }
    };
    fetchOrganizer();
  }, [orderId]);

  
  // Lắng nghe tin nhắn
  useEffect(() => {
    if (!organizerId) return;

    const chatRef = ref(db, `chat_rooms/order_${orderId}/messages`);
    const unsubscribe = onValue(chatRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const messageList = Object.keys(data).map((key) => ({
          id: key,
          text: data[key].text,
          createdAt: new Date(data[key].timestamp),
          senderId: data[key].senderId,
          senderName: data[key].senderName,
        }));
        setMessages(messageList.reverse());
      } else {
        setMessages([]);
      }
    });

    return unsubscribe; // Hủy listener khi unmount
  }, [organizerId]);

  // Gửi tin nhắn
  const onSend = useCallback(async () => {
    if (!newMessage.trim()) return;

    if (!localUser || !localUser.id) {
      console.error('Local user hoặc user.id không tồn tại');
      Alert.alert('Lỗi', 'Thông tin người dùng không hợp lệ. Vui lòng đăng nhập lại.');
      return;
    }

    try {
      const chatRef = ref(db, `chat_rooms/order_${orderId}/messages`);
      const newMessageRef = push(chatRef);
      await set(newMessageRef, {
        senderId: localUser.id.toString(),
        senderName: localUser.firstName || localUser.username || 'Người dùng',
        text: newMessage.trim(),
        timestamp: Date.now(),
      });

      if (!organizerId) {
        console.error('organizerId không tồn tại');
        return;
      }

      const participantsRef = ref(db, `chat_rooms/order_${orderId}/participants`);
      await set(participantsRef, {
        userId: localUser.id.toString(),
        organizerId: organizerId.toString(),
      });

      setNewMessage('');
    } catch (err) {
      console.error('Lỗi khi gửi tin nhắn:', err);
      Alert.alert('Lỗi', 'Không thể gửi tin nhắn. Vui lòng thử lại.');
    }
  }, [localUser, orderId, organizerId, newMessage]);

  // Render tin nhắn
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
              : { backgroundColor: COLORS.lightPrimary },
          ]}
        >
          <Text style={styles.senderName}>{item.senderName}</Text>
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
          placeholder="Nhập tin nhắn..."
          placeholderTextColor={COLORS.textSecondary}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!localUser || !localUser.id || !organizerId || !newMessage.trim()) && { opacity: 0.5 },
          ]}
          onPress={() => {
            console.log('Nút gửi được nhấn', {
              user: !!localUser,
              userId: localUser?.id,
              organizerId: !!organizerId,
              newMessage: newMessage.trim(),
            });
            onSend();
          }}
          disabled={!localUser || !localUser.id || !organizerId || !newMessage.trim()}
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