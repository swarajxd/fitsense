import "./AboutUs.css";

export default function AboutUs() {
  return (
    <>
      <div className="about-container">
        <h1 className="pageheader1">About us</h1>
        <h1 className="aboutus-title">
          REDEFINING <br /> ELEGANCE
        </h1>
        <h1 className="aboutus-description">
          Inclusive designs that
          <br />
          blend comfort and style,
          <br />
          empowering you to stand.
        </h1>
        
        <div className="aboutcard">
          <div className="card-container-1">
            <div className="card-alt">
              <div className="card-content">
                <h1 className="numberlabel1">01</h1>
                <img className="imgcardbox1" src="../../public/cardbox1.png"></img>
                <p className=" randomtext7">Oversized Sweartshirt</p>
              </div>
            </div>
          </div>
          
          <div className="card-container-2">
            <div className="card-alt2">
              <div className="card-content">
                 <h1 className="numberlabel2">02</h1>
                 <img className="imgcardbox2" src="../../public/cardbox2.png"></img>
              </div>
            </div>
          </div>
          
          <div className="card-container-3">
            <div className="card-alt3">
              <div className="card-content">
                 <h1 className="numberlabel2">03</h1>
                 <img className="imgcardbox2" src="../../public/cardbox3.png"></img>
              </div>
            </div>
          </div>
          
          <div className="card-container-4">
            <div className="card-alt4">
              <div className="card-content">
                 <h1 className="numberlabel2">01</h1>
                 <img className="imgcardbox2" src="../../public/cardbox4.png"></img>
              </div>
            </div>
          </div>
        </div>
        
        <div className="randomdiv3">
          <h1 className="randomtext5">OUR PROJECT</h1>
          <p className='randomtext6'>
           We make fashion personal. Share your looks,<br/> explore trends, and get smart outfit recommendations<br/>  tailored to your style. Our community inspires and <br/> connects, turning every outfit into a statement — because<br/>  style should always feel like you.
          </p>
        </div>
      </div>
    </>
  );
}