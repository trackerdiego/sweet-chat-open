/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu código de verificação - InfluLab</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={logo}>🚀 InfluLab</Text>
        <Heading style={h1}>Código de verificação</Heading>
        <Text style={text}>Use o código abaixo para confirmar sua identidade:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          Este código expira em breve. Se você não solicitou, pode ignorar este email com segurança.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '30px 25px' }
const logo = { fontSize: '20px', fontWeight: 'bold' as const, color: 'hsl(258, 60%, 55%)', margin: '0 0 25px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: 'hsl(260, 20%, 15%)', margin: '0 0 20px' }
const text = { fontSize: '15px', color: 'hsl(260, 10%, 45%)', lineHeight: '1.6', margin: '0 0 20px' }
const codeStyle = { fontFamily: 'Courier, monospace', fontSize: '28px', fontWeight: 'bold' as const, color: 'hsl(258, 60%, 55%)', margin: '0 0 30px', letterSpacing: '4px' }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
