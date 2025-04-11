import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Text, View, FlatList, TouchableOpacity } from 'react-native';
import styles from './styles'; 

const Stack = createStackNavigator();

function HomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text>Welcome to Eventgoapp</Text>
      <TouchableOpacity onPress={() => navigation.navigate('EventList')}>
        <Text style={styles.link}>Xem danh sách sự kiện</Text>
      </TouchableOpacity>
    </View>
  );
}

function EventListScreen({ navigation }) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    fetch('http://10.0.2.2:8000/events/')
      .then((response) => response.json())
      .then((data) => setEvents(data))
      .catch((error) => console.error('Error fetching events:', error.message));
  }, []);

  const renderItem = ({ item }) => (
    <TouchableOpacity onPress={() => navigation.navigate('EventDetails', { eventId: item.id })}>
      <View style={styles.eventItem}>
        <Text style={styles.eventName}>{item.name}</Text>
        <Text>{item.date}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
      />
    </View>
  );
}

function EventDetailsScreen({ route }) {
  const { eventId } = route.params;

  return (
    <View style={styles.container}>
      <Text>Event Details Page</Text>
      <Text>Event ID: {eventId}</Text>
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="EventList" component={EventListScreen} />
        <Stack.Screen name="EventDetails" component={EventDetailsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
