import React, { useEffect, useState, useContext } from 'react';
import {
  ScrollView,
  ActivityIndicator,
  Image,
  Text,
  View,
  Alert,
  TouchableOpacity,
  Linking,
  StyleSheet,
  Dimensions,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button as PaperButton,
  Avatar,
  Divider,
  Portal,
  Modal,
  TextInput,
} from 'react-native-paper';
import { MaterialCommunityIcons, AntDesign, Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import api, { endpoints, authApis } from '../../configs/Apis';

import MyStyles, { COLORS } from '../styles/MyStyles';
import { MyUserContext } from "../../configs/MyContexts";
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker } from 'react-native-maps';

// const { width, height } = Dimensions.get('window');

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
  const user = useContext(MyUserContext);
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
        if (user) {
          const userReviewed = res.data.reviews.some(review => review.user === user.username);
          setHasReviewed(userReviewed);
          if (!userReviewed) {
            setCanReview(true);
          }
        }
      } catch (err) {
        console.error('Lỗi khi tải đánh giá:', err);
        setReviews([]);
      } finally {
        setReviewsLoading(false);
      }
    };

    fetchEvent();
    fetchReviews();
  }, [eventId, user]);

  const submitReview = async () => {
    if (!user) {
      Alert.alert('Thông báo', 'Vui lòng đăng nhập để đánh giá');
      return;
    }

    if (rating < 1 || !comment) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ thông tin đánh giá');
      return;
    }

    setReviewSubmitting(true);

    try {
      const reviewData = {
        event_id: eventId,
        rating: rating,
        comment: comment,
      };

      const authApi = authApis(user.access_token);
      await authApi.post(endpoints.reviews, reviewData);

      Alert.alert('Thành công', 'Đánh giá của bạn đã được gửi');
      setModalVisible(false);
      setRating(5);
      setComment('');

      const res = await api.get(endpoints.eventReviews(eventId));
      setReviews(res.data.reviews || []);
      setHasReviewed(true);
    } catch (err) {
      console.error('Lỗi khi gửi đánh giá:', err.response?.data || err.message);
      if (err.response && err.response.status === 401) {
        Alert.alert(
          "Cần đăng nhập",
          "Bạn cần đăng nhập để đánh giá sự kiện này.",
          [{ text: "Đăng nhập", onPress: () => navigation.navigate('login') }]
        );
      }
      // Xử lý lỗi không được phép (chưa tham gia sự kiện)
      else if (err.response && err.response.status === 403) {
        Alert.alert(
          "Không thể đánh giá",
          err.response?.data?.error || "Bạn không thể đánh giá sự kiện mà bạn không tham gia."
        );
      }
      // Xử lý lỗi dữ liệu không hợp lệ
      else if (err.response && err.response.status === 400) {
        Alert.alert(
          "Dữ liệu không hợp lệ",
          err.response?.data?.error || "Vui lòng kiểm tra lại thông tin đánh giá của bạn."
        );
      }
      // Xử lý lỗi server (500 Internal Server Error)
      else if (err.response && err.response.status === 500) {
        Alert.alert(
          "Lỗi máy chủ",
          "Đã xảy ra lỗi ở máy chủ. Vui lòng thử lại sau hoặc liên hệ quản trị viên."
        );
      }
      // Xử lý lỗi không được phép đánh giá (chưa tham gia sự kiện)
      else if (err.response?.data?.non_field_errors) {
        // Hiển thị thông báo lỗi cụ thể từ server
        Alert.alert(
          "Không thể đánh giá",
          err.response.data.non_field_errors[0] || "Bạn cần tham gia sự kiện trước khi đánh giá."
        );
      } else if (err.response?.data?.non_field_errors) {
        Alert.alert(
          'Không thể đánh giá',
          err.response.data.non_field_errors[0] || 'Bạn cần tham gia sự kiện trước khi đánh giá.',
        );
      } else {
        Alert.alert(
          'Lỗi',
          err.response?.data?.detail || 'Không thể gửi đánh giá. Vui lòng thử lại sau.',
        );
      }
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleBookTicket = () => {
    if (!user) {
      Alert.alert("Thông báo", "Vui lòng đăng nhập để đặt vé");
      navigation.navigate('login');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert("Phiên đăng nhập hết hạn", "Vui lòng đăng nhập lại");
        navigation.navigate('login');
        return;
      }

      navigation.navigate('BookTicket', {
        eventId: event.id,
        ticketTypeId: selectedTicketType.id,
        quantity: quantity
      });
      setBookingModalVisible(false);
    } catch (error) {
      console.error("Error navigating to booking:", error);
      Alert.alert("Lỗi", "Không thể đặt vé. Vui lòng thử lại sau.");
    }
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} />;
  if (!event) return <Paragraph style={{ margin: 20, color: 'red' }}>Không tìm thấy sự kiện.</Paragraph>;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Hình ảnh sự kiện */}
        <View style={styles.imageContainer}>
          {event.image && (
            <Image
              source={{
                uri: event.image.startsWith('http')
                  ? event.image
                  : `https://res.cloudinary.com/dqpkxxzaf/${event.image}`,
              }}
              style={styles.eventImage}
              resizeMode="cover"
            />
          )}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        <Card style={styles.card}>
          <Card.Content>
            {/* Tiêu đề sự kiện */}
            <Title style={styles.title}>{event.name}</Title>

            {/* Thông tin cơ bản */}
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="calendar" size={20} color="#7FC8C2" />
              <Text style={styles.infoText}>{new Date(event.date).toLocaleString()}</Text>
            </View>
            <View style={styles.infoRow}>
              <MaterialIcons name="location-on" size={20} color="#7FC8C2" />
              <Text style={styles.infoText}>{event.location}</Text>
            </View>

            {/* Bản đồ địa điểm */}
            {event.google_maps_link && (
              <TouchableOpacity
                style={styles.mapButton}
                onPress={() => Linking.openURL(event.google_maps_link)}
              >
                <FontAwesome5 name="map-marked-alt" size={20} color="#4285F4" />
                <Text style={styles.mapButtonText}>Xem trên Google Maps</Text>
              </TouchableOpacity>
            )}

          {/* Bản đồ mini chỉ xem vị trí */}
          {event.google_maps_link && (
            <View style={{ height: 180, borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
              <MapView
                style={{ flex: 1 }}
                pointerEvents="none" // Không cho tương tác
                initialRegion={(() => {
                  // Cố gắng lấy lat/lng từ link Google Maps
                  const match = event.google_maps_link.match(/q=([\d.]+),([\d.]+)/);
                  if (match) {
                    return {
                      latitude: parseFloat(match[1]),
                      longitude: parseFloat(match[2]),
                      latitudeDelta: 0.005,
                      longitudeDelta: 0.005,
                    };
                  }
                  // Nếu không parse được thì trả về vị trí mặc định (TP.HCM)
                  return {
                    latitude: 10.762622,
                    longitude: 106.660172,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  };
                })()}
              >
                {/* Marker nếu parse được vị trí */}
                {(() => {
                  const match = event.google_maps_link.match(/q=([\d.]+),([\d.]+)/);
                  if (match) {
                    return (
                      <Marker
                        coordinate={{
                          latitude: parseFloat(match[1]),
                          longitude: parseFloat(match[2]),
                        }}
                      />
                    );
                  }
                  return null;
                })()}
              </MapView>
            </View>
          )}

          {event.google_maps_link && (
            <Button
              mode="outlined"
              icon="map-marker"
              onPress={openMap}
              style={{ marginTop: 8, borderColor: COLORS.primary }}
              labelStyle={{ color: COLORS.primary }}
            >
              Xem trên Google Maps
            </Button>
          )}

              <Divider style={styles.divider} />

              {user && canReview && !hasReviewed && (
                <PaperButton
                  mode="outlined"
                  onPress={() => setModalVisible(true)}
                  style={styles.reviewButton}
                  icon="star"
                >
                  Viết đánh giá
                </PaperButton>
              )}

              {hasReviewed && (
                <Paragraph style={styles.reviewedText}>
                  Bạn đã đánh giá sự kiện này
                </Paragraph>
              )}

              {reviewsLoading ? (
                <ActivityIndicator size="small" style={{ marginVertical: 16 }} />
              ) : reviews.length > 0 ? (
                reviews.slice(0, 3).map((review, index) => (
                  <View key={index} style={styles.reviewCard}>
                    <View style={styles.reviewHeader}>
                      <Avatar.Icon size={36} icon="account" style={styles.avatar} />
                      <View style={styles.reviewUser}>
                        <Text style={styles.reviewUserName}>{review.user}</Text>
                        <Text style={styles.reviewDate}>
                          {new Date(review.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.reviewStars}>
                      {Array(5)
                        .fill(0)
                        .map((_, i) => (
                          <AntDesign
                            key={i}
                            name={i < review.rating ? 'star' : 'staro'}
                            size={16}
                            color={i < review.rating ? '#FFD700' : '#aaa'}
                            style={{ marginRight: 2 }}
                          />
                        ))}
                    </View>
                    <Paragraph style={styles.reviewComment}>{review.comment}</Paragraph>
                  </View>
                ))
              ) : (
                <Paragraph style={styles.noReviews}>
                  Chưa có đánh giá nào cho sự kiện này.
                </Paragraph>
              )}

              {reviews.length > 3 && (
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate('ReviewList', { eventId: eventId, eventName: event.name })
                  }
                  style={styles.viewAllReviews}
                >
                  <Text style={styles.viewAllText}>
                    Xem tất cả {reviews.length} đánh giá
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Nút đặt vé cố định ở dưới cùng */}
      <View style={styles.fixedButtonContainer}>
        <PaperButton
          mode="contained"
          onPress={handleBookTicket}
          style={styles.fixedBookButton}
          labelStyle={styles.fixedBookButtonLabel}
        >
          Đặt vé
        </PaperButton>
      </View>

      {/* Modal đánh giá */}
      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Title style={styles.modalTitle}>Đánh giá sự kiện</Title>

          <Text style={styles.modalSubtitle}>Cho điểm</Text>
          <View style={styles.ratingStars}>
            {Array(5)
              .fill(0)
              .map((_, i) => (
                <TouchableOpacity key={i} onPress={() => setRating(i + 1)}>
                  <AntDesign
                    name={i < rating ? 'star' : 'staro'}
                    size={32}
                    color={i < rating ? '#FFD700' : '#aaa'}
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
            style={styles.commentInput}
          />

          <View style={styles.modalButtons}>
            <PaperButton
              mode="outlined"
              onPress={() => setModalVisible(false)}
              style={styles.cancelButton}
            >
              Hủy
            </PaperButton>
            <PaperButton
              mode="contained"
              onPress={submitReview}
              style={styles.submitButton}
              loading={reviewSubmitting}
              disabled={reviewSubmitting}
            >
              Gửi đánh giá
            </PaperButton>
          </View>
        </Modal>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    paddingBottom: 100, // Để không bị che bởi nút cố định
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: height * 0.3,
  },
  eventImage: {
    width: '100%',
    height: '100%',
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
  },
  card: {
    marginTop: -20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: '#FFF',
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    marginLeft: 8,
    color: '#555',
    fontSize: 16,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginVertical: 12,
    justifyContent: 'center',
  },
  mapButtonText: {
    marginLeft: 8,
    color: '#4285F4',
    fontWeight: 'bold',
    fontSize: 16,
  },
  description: {
    marginVertical: 12,
    color: '#555',
    fontSize: 16,
  },
  label: {
    fontWeight: 'bold',
    color: '#333',
  },
  section: {
    marginVertical: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 6,
  },
  fixedButtonContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  fixedBookButton: {
    backgroundColor: '#6D4AFF', 
    borderRadius: 12,
    paddingVertical: 12, 
  },
  fixedBookButtonLabel: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 18, 
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  ratingText: {
    marginLeft: 4,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  reviewCount: {
    marginLeft: 4,
    color: '#666',
    fontSize: 16,
  },
  divider: {
    marginVertical: 8,
  },
  reviewButton: {
    marginVertical: 8,
    borderColor: '#7FC8C2',
  },
  reviewedText: {
    marginVertical: 8,
    fontStyle: 'italic',
    color: '#666',
    textAlign: 'center',
  },
  reviewCard: {
    marginVertical: 8,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    backgroundColor: '#7FC8C2',
  },
  reviewUser: {
    marginLeft: 8,
  },
  reviewUserName: {
    fontWeight: 'bold',
    color: '#333',
  },
  reviewDate: {
    fontSize: 12,
    color: '#666',
  },
  reviewStars: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  reviewComment: {
    color: '#555',
  },
  noReviews: {
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 16,
    color: '#666',
  },
  viewAllReviews: {
    alignItems: 'center',
    marginTop: 8,
  },
  viewAllText: {
    color: '#7FC8C2',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalContainer: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 10,
  },
  modalTitle: {
    textAlign: 'center',
    marginBottom: 16,
    color: '#7FC8C2',
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalSubtitle: {
    textAlign: 'center',
    marginBottom: 8,
    color: '#333',
  },
  ratingStars: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  commentInput: {
    backgroundColor: '#f5f5f5',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  cancelButton: {
    borderColor: '#7FC8C2',
  },
  submitButton: {
    backgroundColor: '#7FC8C2',
  },
});

export default EventDetail;
