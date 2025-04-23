import { StyleSheet } from 'react-native';

const MyStyles = StyleSheet.create({
  cardPastel: {
    margin: 16,
    padding: 16,
    backgroundColor: '#F6E7E7',
    borderRadius: 18,
    borderWidth: 0,
    shadowColor: '#A49393',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  titlePastel: {
    textAlign: 'center',
    marginBottom: 12,
    color: '#A49393',
    fontWeight: 'bold',
    fontSize: 24,
  },
  inputPastel: {
    marginBottom: 16,
    backgroundColor: '#FFF6F6',
  },
  iconPastel: {
    color: '#BFD8D5',
    marginBottom: 4,
  },
  labelPastel: {
    color: '#A49393',
    fontWeight: 'bold',
  },
  textDark: {
    color: '#222',
  },
  avatarPastel: {
    alignSelf: 'center',
    marginBottom: 16,
    backgroundColor: '#BFD8D5',
  },
  buttonPastel: {
    backgroundColor: '#A49393',
    borderRadius: 8,
    margin: 8,
  },
  buttonOutlinePastel: {
    borderColor: '#A49393',
  },
  buttonLabelLight: {
    color: '#FFF6F6',
    fontWeight: 'bold',
  },
  buttonLabelDark: {
    color: '#A49393',
    fontWeight: 'bold',
  },
});

export default MyStyles;
