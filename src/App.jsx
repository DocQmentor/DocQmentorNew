import React from "react";
import { Routes, Route } from "react-router-dom";
import Login from "./components/Login";
import Home from "./components/Home";
import Table from "./components/Table";
import Dashboard from "./components/Dashboard";
import Header from "./Layout/Header";
import Footer from "./Layout/Footer";

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<Login/>}/>
      <Route path="/home" element={<Home/>}/>
      <Route path="/table" element={<Table/>}/>
      <Route path="/Dashboard" element={<Dashboard/>}/>
      <Route path="/Header" element={<Header/>}/>
      <Route path="/Footer" element={<Footer/>}/>
    </Routes>
  );
}

export default App;