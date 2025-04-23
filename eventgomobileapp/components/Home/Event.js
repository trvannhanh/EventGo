import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { Card, Title, Paragraph, Button as PaperButton } from 'react-native-paper';
import MyStyles from "../styles/MyStyles";
import api, { endpoints } from '../../configs/Apis';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const Event = ({ navigation, search = '', eventType = '' }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadEvents = async () => {
      try {
        let res = await api.get(endpoints.events);
        setEvents(res.data);
      } catch (err) {
        setError('Không thể tải danh sách sự kiện.');
      } finally {
        setLoading(false);
      }
    };
    loadEvents();
  }, []);

  // Lọc sự kiện theo search và eventType
  const filteredEvents = events.filter(event => {
    const matchSearch =
      event.title?.toLowerCase().includes(search.toLowerCase()) ||
      event.name?.toLowerCase().includes(search.toLowerCase());
    const matchType = eventType ? (event.type === eventType) : true;
    return matchSearch && matchType;
  });

  const renderItem = ({ item }) => (
    <Card style={MyStyles.cardPastel} onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}>
      <Card.Content>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <MaterialCommunityIcons name="calendar-heart" size={28} style={MyStyles.iconPastel} />
          <Title style={MyStyles.titlePastel}>{item.title || item.name}</Title>
        </View>
        <Paragraph style={MyStyles.labelPastel}>{item.date}</Paragraph>
        <Paragraph numberOfLines={2} style={MyStyles.textDark}>{item.description}</Paragraph>
      </Card.Content>
      <Card.Actions>
        <PaperButton onPress={() => navigation.navigate('EventDetail', { eventId: item.id })} style={MyStyles.buttonPastel} labelStyle={MyStyles.buttonLabelLight}>
          Xem chi tiết
        </PaperButton>
      </Card.Actions>
    </Card>
  );

  if (loading) return <ActivityIndicator size="large" style={{ marginTop: 40 }} />;
  if (error) return <Text style={{ color: 'red', margin: 20 }}>{error}</Text>;

  return (
    <View style={MyStyles.container}>
      <FlatList
        data={filteredEvents}
        keyExtractor={item => item.id?.toString()}
        renderItem={renderItem}
        ListEmptyComponent={<Text>Không có sự kiện nào.</Text>}
      />
    </View>
  );
};

export default Event;
