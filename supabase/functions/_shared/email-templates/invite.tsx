/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: InviteEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Você foi convidado(a) para o InfluLab</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={logo}>🚀 InfluLab</Text>
        <Heading style={h1}>Você foi convidado(a)!</Heading>
        <Text style={text}>
          Você recebeu um convite para fazer parte do <strong>InfluLab</strong>. Clique no botão abaixo para aceitar o convite e criar sua conta.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Aceitar convite
        </Button>
        <Text style={footer}>
          Se você não esperava este convite, pode ignorar este email com segurança.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '30px 25px' }
const logo = { fontSize: '20px', fontWeight: 'bold' as const, color: 'hsl(258, 60%, 55%)', margin: '0 0 25px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: 'hsl(260, 20%, 15%)', margin: '0 0 20px' }
const text = { fontSize: '15px', color: 'hsl(260, 10%, 45%)', lineHeight: '1.6', margin: '0 0 20px' }
const button = { backgroundColor: 'hsl(258, 60%, 55%)', color: '#ffffff', fontSize: '15px', borderRadius: '10px', padding: '14px 24px', textDecoration: 'none', fontWeight: 'bold' as const }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
