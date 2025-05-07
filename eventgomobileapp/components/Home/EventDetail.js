import React, { useEffect, useState, useContext } from 'react';
import { ScrollView, ActivityIndicator, Image, Text, View, Alert, TouchableOpacity, Linking } from 'react-native';
import { Card, Title, Paragraph, Button as PaperButton, Avatar, Divider, Portal, Modal, TextInput, List } from 'react-native-paper';
import { MaterialCommunityIcons, AntDesign, Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import api, { endpoints, authApis } from '../../configs/Apis';
import MyStyles from '../styles/MyStyles';
import { MyUserContext } from "../../configs/MyContexts";

const EventDetail = ({ route, navigation }) => {
  const { eventId } = route.params;
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const user = useContext(MyUserContext); // Sửa lại để không sử dụng destructuring
  const [canReview, setCanReview] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const res = await api.get(endpoints.eventDetail(eventId));
        setEvent(res.data);
      } catch (err) {
        setEvent(null);
      } finally {
        setLoading(false);
      }
    };
    
    const fetchReviews = async () => {
      try {
        const res = await api.get(endpoints.eventReviews(eventId));
        setReviews(res.data.reviews || []);
        // Kiểm tra xem người dùng đã đánh giá chưa
        if (user) {
          const userReviewed = res.data.reviews.some(review => review.user === user.username);
          setHasReviewed(userReviewed);
          
          // Nếu người dùng chưa đánh giá, mặc định cho phép đánh giá
          if (!userReviewed) {
            setCanReview(true);
          }
        }
      } catch (err) {
        console.error("Lỗi khi tải đánh giá:", err);
        setReviews([]);
      } finally {
        setReviewsLoading(false);
      }
    };
    
    // Bỏ việc gọi API checkCanReview nếu endpoint không tồn tại
    // Thay vào đó, chỉ kiểm tra nếu user đã đăng nhập và chưa đánh giá
    
    fetchEvent();
    fetchReviews();
  }, [eventId, user]);

  const submitReview = async () => {
    if (!user) {
      Alert.alert("Thông báo", "Vui lòng đăng nhập để đánh giá");
      return;
    }
    
    if (rating < 1 || !comment) {
      Alert.alert("Lỗi", "Vui lòng nhập đầy đủ thông tin đánh giá");
      return;
    }
    
    setReviewSubmitting(true);
    
    try {
      const reviewData = {
        event_id: eventId,
        rating: rating,
        comment: comment
      };
      
      // Sử dụng authApis thay vì api.post với headers
      const authApi = authApis(user.access_token);
      await authApi.post(endpoints.reviews, reviewData);
      
      Alert.alert("Thành công", "Đánh giá của bạn đã được gửi");
      setModalVisible(false);
      setRating(5);
      setComment('');
      
      // Làm mới danh sách đánh giá
      const res = await api.get(endpoints.eventReviews(eventId));
      setReviews(res.data.reviews || []);
      setHasReviewed(true);
    } catch (err) {
      console.error("Lỗi khi gửi đánh giá:", err.response?.data || err.message);
      
      // Xử lý khi token hết hạn
      if (err.response && err.response.status === 401) {
        Alert.alert(
          "Phiên đăng nhập hết hạn", 
          "Vui lòng đăng nhập lại để tiếp tục.",
          [{ text: "Đăng nhập", onPress: () => navigation.navigate('Login') }]
        );
      } 
      // Xử lý lỗi không được phép đánh giá (chưa tham gia sự kiện)
      else if (err.response?.data?.non_field_errors) {
        // Hiển thị thông báo lỗi cụ thể từ server
        Alert.alert(
          "Không thể đánh giá", 
          err.response.data.non_field_errors[0] || "Bạn cần tham gia sự kiện trước khi đánh giá."
        );
      } 
      // Xử lý các lỗi khác
      else {
        Alert.alert(
          "Lỗi", 
          err.response?.data?.detail || "Không thể gửi đánh giá. Vui lòng thử lại sau."
        );
      }
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} />;
  if (!event) return <Paragraph style={{ margin: 20, color: 'red' }}>Không tìm thấy sự kiện.</Paragraph>;

  return (
    <ScrollView>
      <Card style={MyStyles.cardPastel}>
        <Card.Content>
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <MaterialCommunityIcons name="calendar-star" size={48} style={MyStyles.iconPastel} />
          </View>
          <Title style={MyStyles.titlePastel}>Chi tiết sự kiện</Title>
          {event.image && (
            <Image
              source={{
                uri: event.image.startsWith('http') ? event.image : `https://res.cloudinary.com/dqpkxxzaf/${event.image}`
              }}
              style={{ width: '100%', height: 180, borderRadius: 8, marginBottom: 12, backgroundColor: '#BFD8D5' }}
            />
          )}
          <Paragraph style={MyStyles.labelPastel}>Tên: <Text style={MyStyles.textDark}>{event.name}</Text></Paragraph>
          <Paragraph style={MyStyles.labelPastel}>Ngày: <Text style={MyStyles.textDark}>{event.date}</Text></Paragraph>
          <Paragraph style={MyStyles.labelPastel}>Địa điểm: <Text style={MyStyles.textDark}>{event.location}</Text></Paragraph>
          
          {/* Venue Map Section */}
          {event.google_maps_link && (
            <View style={{ marginVertical: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <MaterialIcons name="location-on" size={20} color="#7FC8C2" />
                <Text style={{ marginLeft: 6, fontWeight: 'bold', color: '#555' }}>Bản đồ địa điểm</Text>
              </View>
              <TouchableOpacity 
                style={{ 
                  backgroundColor: '#f5f5f5', 
                  padding: 12, 
                  borderRadius: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onPress={() => Linking.openURL(event.google_maps_link)}
              >
                <FontAwesome5 name="map-marked-alt" size={24} color="#4285F4" />
                <Text style={{ marginLeft: 8, color: '#4285F4', fontWeight: 'bold' }}>
                  Xem trên Google Maps
                </Text>
              </TouchableOpacity>
            </View>
          )}
          
          <Paragraph style={MyStyles.labelPastel}>Mô tả: <Text style={MyStyles.textDark}>{event.description}</Text></Paragraph>
          
          {/* Ticket Information Section */}
          {event.tickets && event.tickets.length > 0 && (
            <View style={{ marginVertical: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <MaterialCommunityIcons name="ticket-confirmation" size={20} color="#7FC8C2" />
                <Text style={{ marginLeft: 6, fontWeight: 'bold', color: '#555' }}>Thông tin vé</Text>
              </View>
              
              {event.tickets.map((ticket, index) => (
                <View key={index} style={{ 
                  backgroundColor: '#f5f5f5',
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 8,
                  flexDirection: 'row',
                  justifyContent: 'space-between'
                }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: 'bold', color: '#444' }}>{ticket.ticket_type}</Text>
                    <Text style={{ color: '#666', marginTop: 4 }}>{ticket.description || 'Vé tham dự sự kiện'}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontWeight: 'bold', color: '#4285F4' }}>
                      {ticket.price.toLocaleString('vi-VN')} VNĐ
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <MaterialCommunityIcons name="ticket-outline" size={16} color="#666" />
                      <Text style={{ color: ticket.quantity > 0 ? '#4CAF50' : '#F44336', marginLeft: 4 }}>
                        {ticket.quantity > 0 ? `Còn ${ticket.quantity} vé` : 'Hết vé'}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
          
          {/* Hiển thị đánh giá trung bình */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 8 }}>
            <Title style={MyStyles.titlePastel}>Đánh giá và nhận xét</Title>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AntDesign name="star" size={20} color="#FFD700" />
              <Text style={{ marginLeft: 4, fontSize: 16, fontWeight: 'bold' }}>
                {reviews.length > 0 
                  ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) 
                  : "Chưa có"}
              </Text>
              <Text style={{ marginLeft: 4, color: '#666' }}>({reviews.length})</Text>
            </View>
          </View>
          
          <Divider style={{ marginVertical: 8 }} />
          
          {/* Nút đánh giá */}
          {user && canReview && !hasReviewed && (
            <PaperButton 
              mode="outlined" 
              onPress={() => setModalVisible(true)}
              style={{ marginVertical: 8, borderColor: '#7FC8C2' }}
              icon="star"
            >
              Viết đánh giá
            </PaperButton>
          )}
          
          {hasReviewed && (
            <Paragraph style={{ marginVertical: 8, fontStyle: 'italic', color: '#666' }}>
              Bạn đã đánh giá sự kiện này
            </Paragraph>
          )}
          
          {/* Danh sách đánh giá */}
          {reviewsLoading ? (
            <ActivityIndicator size="small" style={{ marginVertical: 16 }} />
          ) : reviews.length > 0 ? (
            reviews.slice(0, 3).map((review, index) => (
              <View key={index} style={{ marginVertical: 8, padding: 8, backgroundColor: '#f5f5f5', borderRadius: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Avatar.Icon size={36} icon="account" style={{ backgroundColor: '#7FC8C2' }} />
                  <View style={{ marginLeft: 8 }}>
                    <Text style={{ fontWeight: 'bold' }}>{review.user}</Text>
                    <Text style={{ fontSize: 12, color: '#666' }}>{new Date(review.created_at).toLocaleDateString()}</Text>
                  </View>
                </View>
                
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 8 }}>
                  {Array(5).fill(0).map((_, i) => (
                    <AntDesign 
                      key={i} 
                      name={i < review.rating ? "star" : "staro"} 
                      size={16} 
                      color={i < review.rating ? "#FFD700" : "#aaa"} 
                      style={{ marginRight: 2 }}
                    />
                  ))}
                </View>
                
                <Paragraph>{review.comment}</Paragraph>
              </View>
            ))
          ) : (
            <Paragraph style={{ fontStyle: 'italic', textAlign: 'center', marginTop: 16 }}>
              Chưa có đánh giá nào cho sự kiện này.
            </Paragraph>
          )}
          
          {reviews.length > 3 && (
            <TouchableOpacity 
              onPress={() => navigation.navigate('ReviewList', { eventId: eventId, eventName: event.name })}
              style={{ alignItems: 'center', marginTop: 8 }}
            >
              <Text style={{ color: '#7FC8C2', fontWeight: 'bold' }}>
                Xem tất cả {reviews.length} đánh giá
              </Text>
            </TouchableOpacity>
          )}
        </Card.Content>
        
        <Card.Actions>
          <PaperButton
            mode="contained"
            onPress={() => navigation.navigate('BookTicket', { eventId: event.id })}
            style={MyStyles.buttonPastel}
            labelStyle={MyStyles.buttonLabelLight}
          >
            Đặt vé
          </PaperButton>
        </Card.Actions>
      </Card>
      
      {/* Modal đánh giá */}
      <Portal>
        <Modal 
          visible={modalVisible} 
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={{ backgroundColor: 'white', padding: 20, margin: 20, borderRadius: 10 }}
        >
          <Title style={{ textAlign: 'center', marginBottom: 16, color: '#7FC8C2' }}>Đánh giá sự kiện</Title>
          
          <Text style={{ textAlign: 'center', marginBottom: 8 }}>Cho điểm</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 16 }}>
            {Array(5).fill(0).map((_, i) => (
              <TouchableOpacity key={i} onPress={() => setRating(i + 1)}>
                <AntDesign 
                  name={i < rating ? "star" : "staro"} 
                  size={32} 
                  color={i < rating ? "#FFD700" : "#aaa"} 
                  style={{ marginHorizontal: 4 }}
                />
              </TouchableOpacity>
            ))}
          </View>
          
          <TextInput
            label="Nhận xét của bạn"
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={4}
            style={{ backgroundColor: '#f5f5f5', marginBottom: 16 }}
          />
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <PaperButton 
              mode="outlined" 
              onPress={() => setModalVisible(false)}
              style={{ borderColor: '#7FC8C2' }}
            >
              Hủy
            </PaperButton>
            
            <PaperButton 
              mode="contained" 
              onPress={submitReview}
              style={{ backgroundColor: '#7FC8C2' }}
              loading={reviewSubmitting}
              disabled={reviewSubmitting}
            >
              Gửi đánh giá
            </PaperButton>
          </View>
        </Modal>
      </Portal>
    </ScrollView>
  );
};

export default EventDetail;