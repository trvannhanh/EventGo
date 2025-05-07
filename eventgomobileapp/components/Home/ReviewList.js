import React, { useEffect, useState, useContext } from 'react';
import { FlatList, View, Text, ActivityIndicator, Alert } from 'react-native';
import { Card, Title, Paragraph, Avatar, Divider } from 'react-native-paper';
import { AntDesign } from '@expo/vector-icons';
import api, { endpoints, authApis } from '../../configs/Apis';
import { MyUserContext } from "../../configs/MyContexts";

const ReviewList = ({ route, navigation }) => {
  const { eventId, eventName } = route.params;
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const user = useContext(MyUserContext);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        setLoading(true);
        console.log(`Fetching reviews for event ${eventId}`);
        
        // Sử dụng API có xác thực nếu người dùng đã đăng nhập
        let response;
        if (user && user.access_token) {
          console.log("Using authenticated API call");
          const authApi = authApis(user.access_token);
          response = await authApi.get(endpoints.eventReviews(eventId));
        } else {
          console.log("Using unauthenticated API call");
          response = await api.get(endpoints.eventReviews(eventId));
        }
        
        console.log("API response structure:", JSON.stringify(response.data).substring(0, 200) + "...");
        
        // Phân tích cấu trúc response để tương thích với cả hai định dạng
        if (response.data && response.data.reviews) {
          // Định dạng mới từ backend: { reviews: [...], average_rating: X, total_reviews: Y }
          console.log("New response format detected");
          setReviews(response.data.reviews || []);
          setAverageRating(response.data.average_rating || 0);
          setTotalReviews(response.data.total_reviews || 0);
        } else if (Array.isArray(response.data)) {
          // Định dạng cũ: [...]
          console.log("Old response format detected (array)");
          setReviews(response.data);
          // Tính toán số liệu thống kê từ mảng
          setTotalReviews(response.data.length);
          if (response.data.length > 0) {
            const sum = response.data.reduce((acc, review) => acc + (review.rating || 0), 0);
            setAverageRating(sum / response.data.length);
          }
        } else {
          // Không có dữ liệu hợp lệ
          console.warn("Unexpected API response format:", response.data);
          setReviews([]);
          setAverageRating(0);
          setTotalReviews(0);
        }
        
        setError(null);
      } catch (err) {
        console.error("Lỗi khi tải đánh giá:", err);
        setReviews([]);
        setAverageRating(0);
        setTotalReviews(0);
        setError(`Không thể tải đánh giá: ${err.message}`);
        Alert.alert("Lỗi", `Không thể tải đánh giá: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    fetchReviews();
  }, [eventId, user]);

  // Header component với thông tin tổng quan về đánh giá
  const ReviewHeader = () => (
    <View style={{ padding: 16, backgroundColor: '#f9f9f9', borderRadius: 8, marginBottom: 16 }}>
      <Title style={{ fontSize: 18, color: '#333', textAlign: 'center' }}>
        Đánh giá sự kiện: {eventName}
      </Title>
      
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8 }}>
        <View style={{ 
          backgroundColor: '#7FC8C2', 
          width: 60, 
          height: 60, 
          borderRadius: 30, 
          justifyContent: 'center', 
          alignItems: 'center',
          marginRight: 16
        }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: 'white' }}>
            {averageRating.toFixed(1)}
          </Text>
        </View>
        
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <AntDesign 
                key={star} 
                name="star" 
                size={16} 
                color={star <= Math.round(averageRating) ? "#FFD700" : "#e0e0e0"} 
                style={{ marginRight: 2 }}
              />
            ))}
          </View>
          <Text style={{ color: '#666', marginTop: 4 }}>
            {totalReviews} đánh giá
          </Text>
        </View>
      </View>
      
      <Divider style={{ marginTop: 16 }} />
    </View>
  );

  // Render item cho mỗi đánh giá
  const renderReviewItem = ({ item }) => {
    if (!item) return null;
    
    return (
      <Card style={{ marginBottom: 12, elevation: 2 }}>
        <Card.Content>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {item.user_avatar ? (
              <Avatar.Image size={40} source={{ uri: item.user_avatar }} />
            ) : (
              <Avatar.Icon size={40} icon="account" style={{ backgroundColor: '#7FC8C2' }} />
            )}
            <View style={{ marginLeft: 12 }}>
              <Text style={{ fontWeight: 'bold' }}>{item.user || 'Người dùng ẩn danh'}</Text>
              <Text style={{ fontSize: 12, color: '#666' }}>
                {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Không rõ thời gian'}
              </Text>
            </View>
          </View>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 8 }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <AntDesign 
                key={star} 
                name={star <= (item.rating || 0) ? "star" : "staro"} 
                size={16} 
                color={star <= (item.rating || 0) ? "#FFD700" : "#aaa"} 
                style={{ marginRight: 2 }}
              />
            ))}
          </View>
          
          <Paragraph>{item.comment || 'Không có nội dung'}</Paragraph>
        </Card.Content>
      </Card>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#7FC8C2" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <AntDesign name="exclamationcircleo" size={50} color="#FF6B6B" />
        <Text style={{ marginTop: 16, fontSize: 16, color: '#666', textAlign: 'center' }}>
          {error}
        </Text>
      </View>
    );
  }

  // Đảm bảo reviews là một mảng trước khi truyền vào FlatList
  const safeReviews = Array.isArray(reviews) ? reviews : [];

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: 'white' }}>
      <FlatList
        data={safeReviews}
        renderItem={renderReviewItem}
        keyExtractor={(item, index) => (item && item.id ? item.id.toString() : index.toString())}
        ListHeaderComponent={<ReviewHeader />}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 50 }}>
            <AntDesign name="staro" size={50} color="#ccc" />
            <Text style={{ marginTop: 16, fontSize: 16, color: '#666', textAlign: 'center' }}>
              Chưa có đánh giá nào cho sự kiện này
            </Text>
          </View>
        }
      />
    </View>
  );
};

export default ReviewList;