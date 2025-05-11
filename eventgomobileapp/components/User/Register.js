import React, { useState } from 'react';
import { View, Alert, StyleSheet, Text, TouchableOpacity, Image, TouchableWithoutFeedback, Keyboard } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import MyStyles from '../styles/MyStyles';
import { TextInput as PaperTextInput, Button as PaperButton, Paragraph, HelperText, Switch } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Apis, { endpoints } from '../../configs/Apis';


const Register = () => {
    const styles = StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: '#FFF5F7',
            padding: 20,
            justifyContent: 'center',
        },
        title: {
            fontSize: 24,
            fontWeight: 'bold',
            color: '#333',
            textAlign: 'center',
            marginBottom: 20,
        },
        input: {
            marginBottom: 15,
            backgroundColor: '#FFF',
        },
        socialButton: {
            marginVertical: 5,
        },
        signInText: {
            textAlign: 'center',
            marginTop: 10,
        },
        avatar: { 
            width: 100,
            height: 100,
            borderRadius: 50,
            margin: 10,
            alignSelf: 'center',
        },
        switchContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            marginVertical: 10,
        },
        switchLabel: {
            marginRight: 10,
            color: '#333',
            fontSize: 16,
        },
    });

    const info = [{
            label: 'Họ và tên lót',
            field: 'last_name',
            icon: 'text',
            secureTextEntry: false
        }, {
            label: 'Tên',
            field: 'first_name',
            icon: 'text',
            secureTextEntry: false
        }, {
            label: 'Tên đăng nhập',
            field: 'username',
            icon: 'account',
            secureTextEntry: false
        }, {
            label: 'Mật khẩu',
            field: 'password',
            icon: 'eye',
            secureTextEntry: true
        },  {
            label: 'Xác nhận mật khẩu',
            field: 'confirm',
            icon: 'eye',
            secureTextEntry: true
        }];


    const [user, setUser] = useState({});
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState();
    const nav = useNavigation();
    const [isEnabled, setIsEnabled] = useState(false);

    const setState = (value, field) => {
        setUser({...user, [field]: value})
    }

    const picker = async () => {
        let { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            alert("Permissions denied!");
        } else {
            const result = await ImagePicker.launchImageLibraryAsync();
            
            if (!result.canceled)
                setState(result.assets[0], 'avatar');
        }
    }

    const toggleSwitch = () => {
        setIsEnabled(previousState => !previousState)
    };

    const validate = () => {
        if (Object.values(user).length == 0) {
            setMsg("Vui lòng nhập thông tin!");
            return false;
        }

        for (let i of info)
            if (user[i.field] === '') {
                setMsg(`Vui lòng nhập ${i.label}!`);
                return false;
            }

        if (user.password && user.password !== user.confirm) {
            setMsg("Mật khẩu không khớp!");
            return false;
        }

        setMsg('');
        return true;
    }



    const register = async () => {
        if (validate() === true) {
            try {
                setLoading(true);
                
                let form = new FormData();
                for (let key in user)
                    if (key !== 'confirm') {
                        if (key === 'avatar') {
                            console.info(Math.random());
                            if (user.avatar?.uri) {
                                form.append('avatar', {
                                    uri: user.avatar.uri,
                                    name: user.avatar.fileName || `image-${Date.now()}.jpg`,
                                    type: user.avatar.type || 'image/jpeg',
                                });
                            }
                        } else
                            form.append(key, user[key]);
                    }

                form.append('role', isEnabled ? 'organizer' : 'attendee');

                let res = await Apis.post(endpoints['register'], form, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                });

                if (res.status === 201)
                    nav.navigate('login');

            } catch (ex) {
                console.error(ex);
            } finally {
                setLoading(false);
            }
        }
    }

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.container}>
                <HelperText type="error" visible={msg}>
                    {msg}
                </HelperText>
                <Text style={styles.title}>Sign up</Text>

                {info.map(i =>  <PaperTextInput
                    key={i.field}
                    secureTextEntry={i.secureTextEntry}
                    mode="outlined"
                    label={i.label}
                    value={user[i.field]}
                    onChangeText={t => setState(t, i.field)}
                    style={styles.input}
                    outlineColor="#A49393"
                    activeOutlineColor="#4A90E2"
                    textColor="#333"
                    left={<PaperTextInput.Icon name="account" color="#4A90E2" />}
                />)}

                <View style={styles.switchContainer}>
                    <Text style={styles.switchLabel}>
                        {isEnabled ? 'Organizer' : 'Attendee'}
                    </Text>
                    <Switch
                        trackColor={{ false: '#767577', true: '#81b0ff' }}
                        thumbColor={isEnabled ? '#f5dd4b' : '#f4f3f4'}
                        ios_backgroundColor="#3e3e3e"
                        onValueChange={toggleSwitch}
                        value={isEnabled}
                    />
                </View>
                
                <TouchableOpacity style={MyStyles.m} onPress={picker}>
                    <Text>Chọn ảnh đại diện...</Text>
                </TouchableOpacity>

                {user?.avatar?.uri && <Image source={{ uri: user.avatar.uri }} style={styles.avatar} />}

                <PaperButton mode="contained" onPress={register} loading={loading} disabled={loading} style={{ backgroundColor: '#6D4AFF', marginVertical: 10 }} labelStyle={{ color: '#FFF' }}>
                    SIGN UP
                </PaperButton>
                <Paragraph style={{ textAlign: 'center', color: '#666' }}>OR</Paragraph>
                <PaperButton mode="outlined" icon="google" onPress={() => {}} style={[styles.socialButton, { borderColor: '#DB4437' }]} labelStyle={{ color: '#DB4437' }}>
                    Login with Google
                </PaperButton>
                <PaperButton mode="outlined" icon="facebook" onPress={() => {}} style={[styles.socialButton, { borderColor: '#3B5998' }]} labelStyle={{ color: '#3B5998' }}>
                    Login with Facebook
                </PaperButton>
                <TouchableOpacity style={styles.signInText}>
                    <Text style={{ color: '#6D4AFF' }}>Already have an account? Sign in</Text>
                </TouchableOpacity>
            </View>
        </TouchableWithoutFeedback>
        
    );
}



export default Register;