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

            // Sử dụng FormData thay vì chuỗi encoded
            const formData = new FormData();
            for (const [key, value] of Object.entries(data)) {
                formData.append(key, value);
            }

            const response = await axios.post(`${API_BASE}o/token/`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            // Lưu token vào AsyncStorage
            await AsyncStorage.setItem('token', response.data.access_token);
            
            try {
                // Tạo API client với token xác thực mới
                const api = axios.create({
                    baseURL: API_BASE,
                    headers: {
                        'Authorization': `Bearer ${response.data.access_token}`
                    }
                });
                
                // Gọi API để lấy thông tin người dùng hiện tại
                const userRes = await api.get('users/current-user/');
                
                // Lưu thông tin người dùng vào state
                dispatch({ type: 'login', payload: userRes.data });
                
                Alert.alert('Thành công', 'Đăng nhập thành công!');
            } catch (userError) {
                console.error('Lỗi khi lấy thông tin người dùng:', userError.response?.data || userError.message);
                
                // Vẫn đăng nhập thành công, chỉ lưu thông tin cơ bản
                dispatch({ 
                    type: 'login', 
                    payload: { 
                        username: username,
                        token: response.data.access_token
                    } 
                });
                
                Alert.alert('Thành công', 'Đăng nhập thành công, nhưng không thể lấy thông tin chi tiết.');
            }
        } catch (error) {
            console.error('Lỗi đăng nhập:', error.response ? error.response.data : error.message);
            Alert.alert('Lỗi', 'Đăng nhập thất bại: ' + (error.response ? JSON.stringify(error.response.data) : error.message));
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