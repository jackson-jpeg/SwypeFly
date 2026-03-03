// 07 — Login (VR-0)
// Exported from Paper MCP - inline styles

export default function Login() {
  return (
    <div style={{ backgroundColor: '#F5ECD7', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', fontSynthesis: 'none', height: '812px', MozOsxFontSmoothing: 'grayscale', overflow: 'clip', WebkitFontSmoothing: 'antialiased', width: '375px', position: 'relative' }}>
      <div style={{ backgroundImage: 'url(https://workers.paper.design/file-assets/01KJP3SDKD0E7NN5G13RNNV649/2HM9ZMHZDYZD26KEHQM0AVDMSW.jpg)', backgroundPosition: 'center', backgroundSize: 'cover', bottom: '0px', boxSizing: 'border-box', height: '100%', left: '0px', objectPosition: 'center 40%', opacity: '0.15', position: 'absolute', width: '100%' }} />

      <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '60px', paddingBottom: '40px', paddingLeft: '20px', paddingRight: '20px', paddingTop: '80px', position: 'relative', zIndex: '10' }}>
        <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ boxSizing: 'border-box', color: '#2C1F1A', fontFamily: '\"Syne\", system-ui, sans-serif', fontSize: '32px', fontWeight: 800, letterSpacing: '-0.01em', lineHeight: '36px', textAlign: 'center', textTransform: 'uppercase', textWrap: 'initial', whiteSpaceCollapse: 'preserve' }}>
            Welcome to SoGoJet
          </div>
          <div style={{ boxSizing: 'border-box', color: '#C9A99A', fontFamily: '\"Inter\", system-ui, sans-serif', fontSize: '14px', lineHeight: '18px', textAlign: 'center', textWrap: 'wrap', whiteSpaceCollapse: 'preserve' }}>
            Discover incredible flight deals and plan your perfect trip
          </div>
        </div>

        <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
          <div style={{ alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: '14px', boxSizing: 'border-box', display: 'flex', flexShrink: '0', gap: '12px', height: '56px', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2C1F1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12c0-4.4 3.6-8 8-8s8 3.6 8 8" />
              <path d="M4 12c0 4.4 3.6 8 8 8s8-3.6 8-8" />
            </svg>
            <div style={{ boxSizing: 'border-box', color: '#2C1F1A', fontFamily: '\"Inter\", system-ui, sans-serif', fontSize: '15px', fontWeight: 600, lineHeight: '18px', textWrap: 'initial', whiteSpaceCollapse: 'preserve' }}>
              Continue with Google
            </div>
          </div>

          <div style={{ alignItems: 'center', backgroundColor: '#2C1F1A', borderRadius: '14px', boxSizing: 'border-box', display: 'flex', flexShrink: '0', gap: '12px', height: '56px', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
            <div style={{ boxSizing: 'border-box', color: '#FDEFC3', fontFamily: '\"Inter\", system-ui, sans-serif', fontSize: '15px', fontWeight: 600, lineHeight: '18px', textWrap: 'initial', whiteSpaceCollapse: 'preserve' }}>
              Continue with Apple
            </div>
          </div>

          <div style={{ alignItems: 'center', backgroundColor: '#FFFDF8', borderColor: '#C9A99A40', borderRadius: '14px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', flexShrink: '0', gap: '12px', height: '56px', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2C1F1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <path d="M2 10h20" />
            </svg>
            <div style={{ boxSizing: 'border-box', color: '#2C1F1A', fontFamily: '\"Inter\", system-ui, sans-serif', fontSize: '15px', fontWeight: 600, lineHeight: '18px', textWrap: 'initial', whiteSpaceCollapse: 'preserve' }}>
              Continue with Email
            </div>
          </div>
        </div>
      </div>

      <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '40px', paddingLeft: '20px', paddingRight: '20px', position: 'relative', zIndex: '10' }}>
        <div style={{ alignItems: 'center', backgroundColor: '#A8C4B830', borderRadius: '14px', boxSizing: 'border-box', display: 'flex', flexShrink: '0', height: '56px', justifyContent: 'center', width: '100%' }}>
          <div style={{ boxSizing: 'border-box', color: '#A8C4B8', fontFamily: '\"Inter\", system-ui, sans-serif', fontSize: '15px', fontWeight: 600, lineHeight: '18px', textWrap: 'initial', whiteSpaceCollapse: 'preserve' }}>
            Continue as Guest
          </div>
        </div>
        <div style={{ boxSizing: 'border-box', color: '#C9A99A', fontFamily: '\"Inter\", system-ui, sans-serif', fontSize: '11px', lineHeight: '14px', textAlign: 'center', textWrap: 'wrap', whiteSpaceCollapse: 'preserve' }}>
          By continuing, you agree to our Terms & Privacy Policy
        </div>
      </div>
    </div>
  );
}
