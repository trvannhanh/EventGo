import React, { useState, useContext } from 'react';
import { View, Alert, TouchableOpacity, Text, StyleSheet, TouchableWithoutFeedback, Keyboard } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Apis, { authApis, endpoints } from '../../configs/Apis';
import { MyDispatchContext } from '../../configs/MyContexts';
import { TextInput as PaperTextInput, Button as PaperButton, Paragraph, Switch, HelperText } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';


const Login = () => {
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
        rememberRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginVertical: 10,
        },
        socialButton: {
            marginVertical: 5,
        },
        signUpText: {
            textAlign: 'center',
            marginTop: 10,
        },
    });

    const info = [{
        label: 'Tên đăng nhập',
        field: 'username',
        icon: 'account',
        secureTextEntry: false,
        autoCapitalize:"none",
        name:"email"
    }, {
        label: 'Mật khẩu',
        field: 'password',
        icon: 'eye',
        autoCapitalize:"none",
        secureTextEntry: true,
        name:"lock"
    }];

    

    const [user, setUser] = useState({});
    const [loading, setLoading] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [msg, setMsg] = useState();
    const nav = useNavigation();
    const dispatch = useContext(MyDispatchContext);

    const setState = (value, field) => {
        setUser({...user, [field]: value})
    }


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

        setMsg('');
        return true;
    }



    const handleLogin = async () => {
        if (validate() === true) {
            try {
                setLoading(true);
    
                let res = await Apis.post(endpoints['login'], {
                    ...user, 
                    client_id: 'RMc1aqYSM98ld8ulAOy1FAyvubnPJiWCeWnnefPC',
                    client_secret: 'pVmRNtsbnYZj7j0vYEbg20GoV8JE74HA4ZG74Ggqxw0OD0a3Qqlz2LGM2M6DVkArIolR3pTv4Kh7Z4mmu5CDqAhUIsOoyDCX8eKoQeRSGWVmwfFVljwtBbicN2EOrozT',
                    grant_type: 'password'
                },{
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                });
                await AsyncStorage.setItem('token', res.data.access_token);

                let u = await authApis(res.data.access_token).get(endpoints['current-user']);
                
                dispatch({
                    "type": "login",
                    "payload": u.data
                });

                if (res.status === 200)
                    nav.navigate('home');

            } catch (ex) {
                if (ex.response && ex.response.status === 400) {
                    setMsg("Tên đăng nhập hoặc mật khẩu không đúng. Vui lòng thử lại.");
                } else {
                    setMsg("Đã xảy ra lỗi. Vui lòng thử lại sau.");
                }
                console.error(ex);
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.container}>
                <MaterialCommunityIcons name="login" size={40} color="#4A90E2" style={{ textAlign: 'center', marginBottom: 10 }} />
                <Text style={styles.title}>Sign in</Text>
                <HelperText type="error" visible={msg}>
                    {msg}
                </HelperText>

                {info.map(i => <PaperTextInput
                    key={i.field}
                    mode="outlined"
                    label={i.label}
                    value={user[i.field]}
                    onChangeText={t => setState(t, i.field)}
                    autoCapitalize={i.autoCapitalize}
                    style={styles.input}
                    outlineColor="#A49393"
                    activeOutlineColor="#4A90E2"
                    textColor="#333"
                    left={<PaperTextInput.Icon name={i.name} color="#4A90E2" />}
                />)}

                {/* <PaperTextInput
                    mode="outlined"
                    label="Email"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    style={styles.input}
                    outlineColor="#A49393"
                    activeOutlineColor="#4A90E2"
                    textColor="#333"
                    left={<PaperTextInput.Icon name="email" color="#4A90E2" />}
                />
                <PaperTextInput
                    mode="outlined"
                    label="Your password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    style={styles.input}
                    outlineColor="#A49393"
                    activeOutlineColor="#4A90E2"
                    textColor="#333"
                    left={<PaperTextInput.Icon name="lock" color="#4A90E2" />}
                /> */}

                <View style={styles.rememberRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Switch value={rememberMe} onValueChange={setRememberMe} color="#6D4AFF" />
                        <Text style={{ color: '#333' }}>Remember Me</Text>
                    </View>
                    <TouchableOpacity>
                        <Text style={{ color: '#6D4AFF' }}>Forgot Password?</Text>
                    </TouchableOpacity>
                </View>
                <PaperButton mode="contained" onPress={handleLogin} loading={loading} disabled={loading} style={{ backgroundColor: '#6D4AFF', marginVertical: 10 }} labelStyle={{ color: '#FFF' }}>
                    SIGN IN
                </PaperButton>
                <Paragraph style={{ textAlign: 'center', color: '#666' }}>OR</Paragraph>
                <PaperButton mode="outlined" icon="google" onPress={() => {}} style={[styles.socialButton, { borderColor: '#DB4437' }]} labelStyle={{ color: '#DB4437' }}>
                    Login with Google
                </PaperButton>
                <PaperButton mode="outlined" icon="facebook" onPress={() => {}} style={[styles.socialButton, { borderColor: '#3B5998' }]} labelStyle={{ color: '#3B5998' }}>
                    Login with Facebook
                </PaperButton>
                <TouchableOpacity style={styles.signUpText}>
                    <Text style={{ color: '#6D4AFF' }}>Don't have an account? Sign up</Text>
                </TouchableOpacity>
            </View>
        </TouchableWithoutFeedback>
        
    );

}


export default Login;
