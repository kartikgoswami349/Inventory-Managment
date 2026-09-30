import { Redirect } from 'expo-router';
import { StyleSheet } from 'react-native';

export default function Index() {
  return <Redirect href="/dashboard" />;
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F8',
    paddingHorizontal: 22,
    paddingTop: 20,
  },

  header: {
    marginTop: 20,
  },

  brand: {
    fontSize: 18,
    fontWeight: '800',
    color: '#166534',
  },

  title: {
    fontSize: 38,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },

  subtitle: {
    fontSize: 15,
    color: '#64748B',
    marginTop: 5,
  },

  actions: {
    marginTop: 50,
    gap: 15,
  },

  primaryButton: {
    backgroundColor: '#166534',
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },

  secondaryButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDE3EA',
  },

  secondaryButtonText: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '700',
  },

  buttonPressed: {
    opacity: 0.75,
  },

  infoCard: {
    marginTop: 35,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
  },

  infoTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },

  infoText: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 8,
  },

  footer: {
    marginTop: 'auto',
    textAlign: 'center',
    color: '#94A3B8',
    paddingBottom: 18,
    fontSize: 12,
  },
});