import { useState } from 'react';


const DashboardScreen = () => {

    const [count, setCount] = useState(0);

    const increment = () => setCount((c) => c + 1)
    const decrement = () => setCount((c) => c - 1)

    return (
        <div>
            <h1>{count}</h1>
            <button onClick={increment}>+</button>
            <button onClick={decrement}>-</button>
        </div>
    )

};

export default DashboardScreen;