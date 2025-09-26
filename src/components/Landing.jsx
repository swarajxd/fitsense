// Landing.jsx
import './Landing.css';
import { GiSevenPointedStar } from "react-icons/gi";
import { SignInButton, useUser } from "@clerk/clerk-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Landing(){
  const { isSignedIn } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    // when Clerk reports signed-in, go to Discover
    if (isSignedIn) {
      navigate("/home");
    }
  }, [isSignedIn, navigate]);

  return (
    <div className="landingcontainer">
      <img className='landingback' src='../../LandingPage2.png' />
      <img className='icons1' src='../../icons2.png' />
      <GiSevenPointedStar 
        style={{
          color: 'orange',
          position:'absolute',
          bottom:'30%',
          left:'15%',
          fontSize: '34px'
        }} 
      />
      
      <h1 className='landing-title'>STYLECRAFT <br/> REVOLUTION</h1>
      <p className='randomtext1'>#Fashion</p>

      <div className="randomdiv1">
        <p className='randomtext2'>Scroll Down</p>
        <p className='randomtext3'>
          Upload your photo, let AI analyze your look, and<br/>
          instantly receive personalized fashion suggestions <br/>
          to refresh and elevate your style.
        </p>
      </div>

      <div className="randomdiv2">
        <p className='randomtext4'>
          Share your photo, let AI decode <br/>
          your outfit, and get tailored fashion <br/>
          tips to transform, refine, and elevate<br/>
          your unique style.
        </p>
      </div>
    </div>
  );
}