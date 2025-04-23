import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Event from './Event';
import MyStyles from '../styles/MyStyles';
import { Card, Title, TextInput as PaperTextInput, Button as PaperButton, Paragraph } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const EVENT_TYPES = [
    { label: 'Tất cả', value: '' },
    { label: 'Âm nhạc', value: 'music' },
    { label: 'Hội thảo', value: 'seminar' },
    { label: 'Thể thao', value: 'sport' },
];

const Home = ({ navigation }) => {
    const [search, setSearch] = useState('');
    const [eventType, setEventType] = useState('');

    return (
        <View style={{ flex: 1 }}>
            <Card style={MyStyles.cardPastel}>
                <Card.Content>
                    <View style={{ alignItems: 'center', marginBottom: 12 }}>
                        <MaterialCommunityIcons name="magnify" size={40} style={MyStyles.iconPastel} />
                    </View>
                    <Title style={MyStyles.titlePastel}>Tìm kiếm sự kiện</Title>
                    <PaperTextInput
                        mode="outlined"
                        label="Tìm kiếm sự kiện..."
                        value={search}
                        onChangeText={setSearch}
                        style={MyStyles.inputPastel}
                        outlineColor="#A49393"
                        activeOutlineColor="#A49393"
                        textColor="#222"
                    />
                    <Picker
                        selectedValue={eventType}
                        style={[MyStyles.inputPastel, { borderRadius: 8 }]}
                        onValueChange={(itemValue) => setEventType(itemValue)}
                    >
                        {EVENT_TYPES.map((type) => (
                            <Picker.Item key={type.value} label={type.label} value={type.value} />
                        ))}
                    </Picker>
                </Card.Content>
            </Card>
            <Event navigation={navigation} search={search} eventType={eventType} />
        </View>
    );
};

export default Home;
