import React, { useState, useContext } from 'react';
import { View, Alert } from 'react-native';
import axios from 'axios';
import MyStyles from '../styles/MyStyles';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../../configs/Apis';
import { authApis } from '../../configs/Apis';
import { MyDispatchContext } from '../../configs/MyContexts';
import { Card, Title, TextInput as PaperTextInput, Button as PaperButton, Paragraph } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const dispatch = useContext(MyDispatchContext);

    const handleLogin = async () => {
        setLoading(true);
        try {
            const data = {
                grant_type: 'password',
                username,
                password,
                client_id: 'pD7UpIjBUdkylCiTFQ5oURKDu61S9DfpEpbX2sBZ',
                client_secret: 'eeN7xeN4jxCiGVN9HKI3j9NhNbHrJrbmlDVlCEvnhk5yV3d7uXwLbiUxfeHYIa3A2IhYAbrB9MQ8GHs30ARomfdwMiyy9olP5qlNzgaO4VE03efF7889NZqdgTqNYgIq'
            };
            const formBody = Object.entries(data).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
            const response = await axios.post(`${API_BASE}o/token/`, formBody, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            await AsyncStorage.setItem('token', response.data.access_token);
            
            
            const userRes = await authApis(response.data.access_token).get('users/current-user/');
            dispatch({ type: 'login', payload: userRes.data });
           
            
            Alert.alert('Thành công', 'Đăng nhập thành công!');
        } catch (error) {
            
            Alert.alert('Lỗi', 'Đăng nhập thất bại!');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card style={MyStyles.cardPastel}>
            <Card.Content>
                <View style={{ alignItems: 'center', marginBottom: 12 }}>
                    <MaterialCommunityIcons name="login" size={48} style={MyStyles.iconPastel} />
                </View>
                <Title style={MyStyles.titlePastel}>Đăng nhập</Title>
                <PaperTextInput
                    mode="outlined"
                    label="Tên đăng nhập"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
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
                <PaperButton mode="contained" onPress={handleLogin} loading={loading} disabled={loading} style={MyStyles.buttonPastel} labelStyle={MyStyles.buttonLabelLight}>
                    Đăng nhập
                </PaperButton>
            </Card.Content>
        </Card>
    );
}