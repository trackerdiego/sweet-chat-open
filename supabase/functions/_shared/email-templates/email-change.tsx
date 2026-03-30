/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface EmailChangeEmailProps {
  siteName: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({ siteName, email, newEmail, confirmationUrl }: EmailChangeEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Confirme a alteração de email no InfluLab</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={logo}>🚀 InfluLab</Text>
        <Heading style={h1}>Confirme a alteração de email</Heading>
        <Text style={text}>
          Você solicitou a alteração do seu email no <strong>InfluLab</strong> de{' '}
          <Link href={`mailto:${email}`} style={linkStyle}>{email}</Link>{' '}para{' '}
          <Link href={`mailto:${newEmail}`} style={linkStyle}>{newEmail}</Link>.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Confirmar alteração
        </Button>
        <Text style={footer}>
          Se você não solicitou esta alteração, proteja sua conta imediatamente.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '30px 25px' }
const logo = { fontSize: '20px', fontWeight: 'bold' as const, color: 'hsl(258, 60%, 55%)', margin: '0 0 25px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: 'hsl(260, 20%, 15%)', margin: '0 0 20px' }
const text = { fontSize: '15px', color: 'hsl(260, 10%, 45%)', lineHeight: '1.6', margin: '0 0 20px' }
const linkStyle = { color: 'hsl(258, 60%, 55%)', textDecoration: 'underline' }
const button = { backgroundColor: 'hsl(258, 60%, 55%)', color: '#ffffff', fontSize: '15px', borderRadius: '10px', padding: '14px 24px', textDecoration: 'none', fontWeight: 'bold' as const }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
