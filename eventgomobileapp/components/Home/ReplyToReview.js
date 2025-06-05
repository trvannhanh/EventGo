import React, { useState, useContext, useEffect } from "react";
import { View, StyleSheet, Alert } from "react-native";
import { TextInput, Button, Surface, Text, Appbar } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api, endpoints, authApis } from "../../configs/Apis";
import { MyUserContext } from "../../configs/MyContexts";
import { COLORS } from "../styles/MyStyles";
import { useFocusEffect } from "@react-navigation/native";

const ReplyToReview = ({ route, navigation }) => {
  const { eventId, reviewId, eventName, fromScreen } = route.params;
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const user = useContext(MyUserContext);

  const handleSubmit = async () => {
    if (!reply.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập nội dung phản hồi");
      return;
    }

    if (!user || (!user.is_superuser && user.role !== "organizer")) {
      Alert.alert("Lỗi", "Bạn không có quyền phản hồi đánh giá này");
      navigation.goBack();
      return;
    }

    setLoading(true);

    try {
      const authApi = authApis(user.access_token);
      const url = endpoints.replyToReview(eventId, reviewId);

      console.log("Request URL:", url);
      console.log("Request data:", { reply });
      const response = await authApi.post(url, { reply });
      console.log("Response:", response.data);

      // Show success message and navigate back with immediate refresh
      Alert.alert("Thành công", "Phản hồi của bạn đã được gửi", [
        {
          text: "OK",
          onPress: () => {
            // Navigate back and trigger immediate refresh
            if (fromScreen === "ReviewList") {
              navigation.navigate("ReviewList", {
                eventId: eventId,
                eventName: eventName,
                timestamp: Date.now(), // Để trigger refresh
              });
            } else {
              // Default to EventDetail screen with immediate refresh
              navigation.navigate("EventDetail", {
                eventId: eventId,
                timestamp: Date.now(), // Để trigger refresh
              });
            }
          },
        },
      ]);
    } catch (error) {
      console.error("Error submitting reply:", error);
      console.error("Error details:", error.response?.data || error.message);

      let errorMsg = "Không thể gửi phản hồi. Vui lòng thử lại sau.";

      if (error.response) {
        if (error.response.status === 401) {
          errorMsg = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
        } else if (error.response.status === 403) {
          errorMsg = "Bạn không có quyền phản hồi đánh giá này.";
        } else if (error.response.data?.error) {
          errorMsg = error.response.data.error;
        }
      }

      Alert.alert("Lỗi", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Phản hồi đánh giá" subtitle={eventName} />
      </Appbar.Header>

      <Surface style={styles.content}>
        <Text style={styles.title}>Phản hồi đánh giá</Text>
        <Text style={styles.subtitle}>
          Hãy viết phản hồi của bạn với tư cách là ban tổ chức sự kiện hoặc quản
          trị viên. Phản hồi của bạn sẽ được hiển thị công khai cho tất cả người
          dùng.
        </Text>

        <TextInput
          mode="outlined"
          label="Nội dung phản hồi"
          value={reply}
          onChangeText={setReply}
          multiline
          numberOfLines={8}
          style={styles.input}
          placeholder="Nhập phản hồi của bạn ở đây..."
          outlineColor={COLORS.border}
          activeOutlineColor={COLORS.primary}
        />

        <Button
          mode="contained"
          onPress={handleSubmit}
          style={styles.button}
          loading={loading}
          disabled={loading || !reply.trim()}
          icon={({ size, color }) => (
            <MaterialCommunityIcons name="send" size={size} color={color} />
          )}
        >
          Gửi phản hồi
        </Button>
      </Surface>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.primary,
  },
  content: {
    flex: 1,
    padding: 16,
    backgroundColor: COLORS.background,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: COLORS.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 24,
    lineHeight: 20,
  },
  input: {
    backgroundColor: COLORS.background,
    marginBottom: 24,
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: 6,
  },
});

export default ReplyToReview;
