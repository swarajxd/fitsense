import './NavBar2.css';
import { IoMailOutline } from "react-icons/io5";
export default function NavBar2(){


    return(
        <>
        <div className="navbar2">
        <div className="info">
            <h1><IoMailOutline />info@kuwloagem.com</h1>
        </div>
        <div className="logocontainer">
            <h1>FITSENSE</h1>
        </div>
        <div class="nav-links">
                <a href="#">Home</a>
                <a href="#">About</a>
                <a href="#">Services</a>
                <a href="#">Contact</a>
            </div>
        
        </div>
        
        
        </>


    );
}