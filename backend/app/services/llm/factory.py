"""LLM provider factory."""

from typing import Dict, Type, Optional
from app.core.config import settings
from .base_provider import BaseLLMProvider
from .openai_provider import OpenAIProvider
from .anthropic_provider import AnthropicProvider


class LLMProviderFactory:
    """Factory for creating LLM providers."""
    
    # Registry of available providers
    _providers: Dict[str, Type[BaseLLMProvider]] = {
        "openai": OpenAIProvider,
        "anthropic": AnthropicProvider,
    }
    
    @classmethod
    def create_provider(
        self, 
        provider_name: Optional[str] = None,
        model: Optional[str] = None,
        **kwargs
    ) -> BaseLLMProvider:
        """
        Create an LLM provider instance.
        
        Args:
            provider_name: Provider to use (defaults to settings.llm_provider)
            model: Model to use (defaults to settings.llm_model)
            **kwargs: Additional provider-specific arguments
            
        Returns:
            Configured LLM provider instance
            
        Raises:
            ValueError: If provider is not supported or configuration is invalid
        """
        provider_name = provider_name or settings.llm_provider
        model = model or settings.llm_model
        
        if provider_name not in self._providers:
            available = ", ".join(self._providers.keys())
            raise ValueError(f"Unknown LLM provider: {provider_name}. Available: {available}")
        
        provider_class = self._providers[provider_name]
        
        # Get provider-specific configuration
        if provider_name == "openai":
            api_key = settings.openai_api_key
            if not api_key:
                raise ValueError("OpenAI API key not configured")
        elif provider_name == "anthropic":
            api_key = settings.anthropic_api_key
            if not api_key:
                raise ValueError("Anthropic API key not configured")
        else:
            raise ValueError(f"Unknown provider configuration: {provider_name}")
        
        # Merge with default settings
        provider_kwargs = {
            "temperature": settings.llm_temperature,
            "max_tokens": settings.llm_max_tokens,
            "timeout": settings.llm_timeout,
            **kwargs  # Allow overrides
        }
        
        return provider_class(api_key=api_key, model=model, **provider_kwargs)
    
    @classmethod
    def register_provider(cls, name: str, provider_class: Type[BaseLLMProvider]) -> None:
        """
        Register a new provider type.
        
        Args:
            name: Provider name
            provider_class: Provider implementation class
        """
        if not issubclass(provider_class, BaseLLMProvider):
            raise ValueError(f"Provider class must inherit from BaseLLMProvider")
        
        cls._providers[name] = provider_class
        print(f"✓ Registered LLM provider: {name}")
    
    @classmethod
    def get_available_providers(cls) -> Dict[str, Type[BaseLLMProvider]]:
        """Get all available providers."""
        return cls._providers.copy()
    
    @classmethod
    def is_provider_available(cls, provider_name: str) -> bool:
        """Check if a provider type is available."""
        return provider_name in cls._providers 