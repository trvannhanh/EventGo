import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card, Title, Paragraph, Button as PaperButton } from 'react-native-paper';

const MyTickets = () => {
  return (
    <Card style={{ margin: 16, padding: 16 }}>
      <Card.Content>
        <Title>Vé của tôi</Title>
        {/* Hiển thị danh sách vé đã đặt ở đây */}
        {/* Ví dụ: <Paragraph>Mã QR: ...</Paragraph> */}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default MyTickets;