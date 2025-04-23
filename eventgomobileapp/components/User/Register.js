import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import api from '../../configs/Apis'; // dùng api đã cấu hình baseURL
import MyStyles from '../styles/MyStyles';
import { Card, Title, TextInput as PaperTextInput, Button as PaperButton, Paragraph } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function Register() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleRegister = async () => {
        setLoading(true);
        try {
            const response = await api.post('users/', {
                username,
                email,
                password,
            }, {
                headers: { 'Content-Type': 'application/json' }
            });
            Alert.alert('Thành công', 'Đăng ký thành công!');
        } catch (error) {     
            Alert.alert('Lỗi', 'Đăng ký thất bại!');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card style={MyStyles.cardPastel}>
            <Card.Content>
                <View style={{ alignItems: 'center', marginBottom: 12 }}>
                    <MaterialCommunityIcons name="account-plus" size={48} style={MyStyles.iconPastel} />
                </View>
                <Title style={MyStyles.titlePastel}>Đăng ký</Title>
                <PaperTextInput
                    mode="outlined"
                    label="Tên đăng nhập"
                    value={username}
                    onChangeText={setUsername}
                    style={MyStyles.inputPastel}
                    outlineColor="#A49393"
                    activeOutlineColor="#A49393"
                    textColor="#222"
                />
                <PaperTextInput
                    mode="outlined"
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    style={MyStyles.inputPastel}
                    outlineColor="#A49393"
                    activeOutlineColor="#A49393"
                    textColor="#222"
                />
                <PaperTextInput
                    mode="outlined"
                    label="Mật khẩu"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    style={MyStyles.inputPastel}
                    outlineColor="#A49393"
                    activeOutlineColor="#A49393"
                    textColor="#222"
                />
                <PaperButton mode="contained" onPress={handleRegister} loading={loading} disabled={loading} style={MyStyles.buttonPastel} labelStyle={MyStyles.buttonLabelLight}>
                    Đăng ký
                </PaperButton>
            </Card.Content>
        </Card>
    );
}