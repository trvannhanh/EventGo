import React, { useEffect, useState } from 'react';
import { ScrollView, ActivityIndicator, Image, Text, View } from 'react-native';
import { Card, Title, Paragraph, Button as PaperButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import api, { endpoints } from '../../configs/Apis';
import MyStyles from '../styles/MyStyles';

const EventDetail = ({ route, navigation }) => {
  const { eventId } = route.params;
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

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
    fetchEvent();
  }, [eventId]);

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
          <Paragraph style={MyStyles.labelPastel}>Mô tả: <Text style={MyStyles.textDark}>{event.description}</Text></Paragraph>
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
    </ScrollView>
  );
};

export default EventDetail;