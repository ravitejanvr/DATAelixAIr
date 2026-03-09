/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Verify your email for DATAelixAIr</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://mhqdqilzkqvbgtygtlab.supabase.co/storage/v1/object/public/email-assets/brain-logo.png"
          width="40"
          height="40"
          alt="DATAelixAIr"
          style={{ marginBottom: '24px' }}
        />
        <Heading style={h1}>Verify your email</Heading>
        <Text style={text}>
          Welcome to{' '}
          <Link href={siteUrl} style={link}>
            <strong>DATAelixAIr™</strong>
          </Link>
          — your AI clinical documentation workspace.
        </Text>
        <Text style={text}>
          Please confirm your email address (
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ) to get started:
        </Text>
        <Button style={button} href={confirmationUrl}>
          Verify Email →
        </Button>
        <Text style={text}>
          Once verified, your account will be reviewed by an administrator before you can access the clinical workspace.
        </Text>
        <Text style={footer}>
          If you didn't create an account, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif" }
const container = { padding: '32px 28px' }
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: 'hsl(222, 47%, 11%)',
  margin: '0 0 20px',
  fontFamily: "'Syne', 'Helvetica Neue', Arial, sans-serif",
}
const text = {
  fontSize: '14px',
  color: 'hsl(215, 20%, 65%)',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const link = { color: 'hsl(200, 98%, 39%)', textDecoration: 'underline' }
const button = {
  backgroundColor: 'hsl(200, 98%, 39%)',
  color: 'hsl(204, 100%, 97%)',
  fontSize: '14px',
  fontWeight: '600' as const,
  borderRadius: '8px',
  padding: '12px 24px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
