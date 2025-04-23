import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card, Title, Paragraph, Button as PaperButton } from 'react-native-paper';
import MyStyles from '../styles/MyStyles';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const MyTickets = () => {
  return (
    <Card style={MyStyles.cardPastel}>
      <Card.Content>
        <View style={{ alignItems: 'center', marginBottom: 12 }}>
          <MaterialCommunityIcons name="ticket-confirmation" size={48} style={MyStyles.iconPastel} />
        </View>
        <Title style={MyStyles.titlePastel}>Vé của tôi</Title>
        
      </Card.Content>
    </Card>
  );
};

export default MyTickets;