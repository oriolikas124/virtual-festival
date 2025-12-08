import Image from "next/image";

export default function Header() {
    return (
        <header className="mx-auto my-4 md:my-6">
            <Image 
                src="/logo.svg" 
                alt="Logo" 
                width={150} 
                height={100} 
                className="w-[150px] md:w-[250px]" 
                priority 
            />
        </header>
    );
}