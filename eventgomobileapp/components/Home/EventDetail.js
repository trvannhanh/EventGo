import React, { useEffect, useState } from 'react';
import { ScrollView, ActivityIndicator, Image } from 'react-native';
import { Card, Title, Paragraph, Button as PaperButton } from 'react-native-paper';
import api, { endpoints } from '../../configs/Apis';

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
      <Card style={{ margin: 16, padding: 16 }}>
        <Card.Content>
          <Title>{event.name}</Title>
          {event.image && (
            <Image
              source={{
                uri: event.image
                  ? (event.image.startsWith('http')
                      ? event.image
                      : `https://res.cloudinary.com/dqpkxxzaf/${event.image}`)
                  : undefined
              }}
              style={{ width: '100%', height: 180, borderRadius: 8, marginBottom: 12 }}
            />
          )}
          <Paragraph>Ngày: {event.date}</Paragraph>
          <Paragraph>Địa điểm: {event.location}</Paragraph>
          <Paragraph>Mô tả: {event.description}</Paragraph>
          
        </Card.Content>
        <Card.Actions>
          <PaperButton
            mode="contained"
            onPress={() => navigation.navigate('BookTicket', { eventId: event.id })}
          >
            Đặt vé
          </PaperButton>
        </Card.Actions>
      </Card>
    </ScrollView>
  );
};

export default EventDetail;